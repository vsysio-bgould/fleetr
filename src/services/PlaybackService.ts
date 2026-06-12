import db from "@/lib/db";
import { queueAdvanceQueue } from "@/lib/queue";
import { NotFoundError } from "@/lib/errors";
import logger from "@/lib/logger";
import { broadcastToFleet } from "@/lib/broadcast";
import type { FleetMode, QueueType } from "@prisma/client";
import type { FleetNowPlaying, ServerMessage } from "@/config/party-messages";

export interface PlaybackState {
  fleetId: string;
  queueEntryId: string | null;
  mediaId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  startedAt: string | null;
  fleetOffsetSeconds: number | null;
}

const ADVANCE_JOB_ID = (fleetId: string) => `fleet-advance:${fleetId}`;

interface PlayableEntry {
  id: string;
  mediaId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
}

const PLAYABLE_SELECT = {
  id: true,
  mediaId: true,
  title: true,
  thumbnailUrl: true,
  duration: true,
} as const;

export class PlaybackService {
  async getState(fleetId: string): Promise<PlaybackState> {
    const playback = await db.playback.findUnique({
      where: { fleetId },
      include: {
        queueEntry: {
          select: { title: true, thumbnailUrl: true, duration: true },
        },
      },
    });

    if (!playback) throw new NotFoundError("Fleet playback state");

    const startedAt = playback.startedAt?.toISOString() ?? null;
    const fleetOffsetSeconds =
      startedAt != null
        ? (Date.now() - new Date(startedAt).getTime()) / 1000
        : null;

    return {
      fleetId,
      queueEntryId: playback.queueEntryId,
      mediaId: playback.mediaId,
      title: playback.queueEntry?.title ?? null,
      thumbnailUrl: playback.queueEntry?.thumbnailUrl ?? null,
      duration: playback.queueEntry?.duration ?? null,
      startedAt,
      fleetOffsetSeconds,
    };
  }

  async setTrack(
    fleetId: string,
    queueEntryId: string,
    initiatedBy: number | null
  ): Promise<void> {
    const entry = await db.queueEntry.findUnique({
      where: { id: queueEntryId },
      select: { ...PLAYABLE_SELECT, fleetId: true },
    });

    if (!entry || entry.fleetId !== fleetId) {
      throw new NotFoundError("Queue entry");
    }

    const nowPlaying = await this.applyTrack(fleetId, entry);

    void broadcastToFleet(fleetId, {
      type: "fleet:now-playing",
      payload: nowPlaying,
    } satisfies ServerMessage);

    logger.info({ fleetId, queueEntryId, initiatedBy }, "Playback track set");
  }

  async advance(
    fleetId: string,
    initiatedBy: number | null
  ): Promise<{ nowPlaying: boolean }> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { mode: true },
    });
    if (!fleet) throw new NotFoundError("Fleet");

    const nextEntry = await this.topOfQueue(fleetId, fleet.mode);

    if (!nextEntry) {
      await this.clearTrack(fleetId);

      void broadcastToFleet(fleetId, {
        type: "fleet:now-playing",
        payload: null,
      } satisfies ServerMessage);

      logger.info({ fleetId, initiatedBy }, "Queue exhausted, playback cleared");
      return { nowPlaying: false };
    }

    await this.setTrack(fleetId, nextEntry.id, initiatedBy);
    return { nowPlaying: true };
  }

  /**
   * Switch fleet mode. This is a mandatory interrupt (party-messages contract):
   * the fleet reference jumps to the top of the new queue (or clears if empty)
   * and a single fleet:mode-changed message carries both the mode and the new
   * reference so clients can reload immediately.
   */
  async setMode(
    fleetId: string,
    mode: FleetMode,
    initiatedBy: number | null
  ): Promise<void> {
    const previous = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { mode: true },
    });
    await db.fleet.update({ where: { id: fleetId }, data: { mode } });

    const topEntry = await this.topOfQueue(fleetId, mode);

    let nowPlaying: FleetNowPlaying | null = null;
    if (topEntry) {
      nowPlaying = await this.applyTrack(fleetId, topEntry);
    } else {
      await this.clearTrack(fleetId);
    }

    void broadcastToFleet(fleetId, {
      type: "fleet:mode-changed",
      mode,
      nowPlaying,
    } satisfies ServerMessage);

    await db.auditLog.create({
      data: {
        event: "fleet.mode-changed",
        actor: initiatedBy !== null ? String(initiatedBy) : "system",
        payload: { fleetId, oldMode: previous?.mode ?? null, newMode: mode },
      },
    });

    logger.info({ fleetId, mode, initiatedBy }, "Fleet mode changed");
  }

  async setVolume(fleetId: string, volume: number): Promise<void> {
    // Volume is runtime state only — no DB write needed.
    void broadcastToFleet(fleetId, {
      type: "fleet:volume-changed",
      volume,
    } satisfies ServerMessage);
    logger.debug({ fleetId, volume }, "Fleet volume changed");
  }

  /** Persist the reference track + schedule auto-advance. Does not broadcast. */
  private async applyTrack(
    fleetId: string,
    entry: PlayableEntry
  ): Promise<FleetNowPlaying> {
    const startedAt = new Date();

    await db.playback.upsert({
      where: { fleetId },
      update: { queueEntryId: entry.id, mediaId: entry.mediaId, startedAt },
      create: { fleetId, queueEntryId: entry.id, mediaId: entry.mediaId, startedAt },
    });

    await this.scheduleAdvance(fleetId, entry.duration);

    return {
      queueEntryId: entry.id,
      mediaId: entry.mediaId,
      title: entry.title,
      thumbnailUrl: entry.thumbnailUrl,
      duration: entry.duration,
      startedAt: startedAt.toISOString(),
    };
  }

  private async clearTrack(fleetId: string): Promise<void> {
    await db.playback.upsert({
      where: { fleetId },
      update: { queueEntryId: null, mediaId: null, startedAt: null },
      create: { fleetId },
    });
    await this.cancelAdvance(fleetId);
  }

  /** Top of a queue: votes desc, position asc — same order the queue UI shows. */
  private async topOfQueue(fleetId: string, mode: FleetMode) {
    // FleetMode and QueueType share the same values (CRUISE | BATTLE)
    const queue = mode as string as QueueType;
    const entries = await db.queueEntry.findMany({
      where: { fleetId, queue, removedAt: null },
      select: { ...PLAYABLE_SELECT, position: true, _count: { select: { votes: true } } },
      // TODO: exclude already-played entries (needs plays table in future)
    });
    if (entries.length === 0) return null;

    entries.sort(
      (a, b) => b._count.votes - a._count.votes || a.position - b.position
    );
    return entries[0];
  }

  private async scheduleAdvance(
    fleetId: string,
    durationSeconds: number | null
  ): Promise<void> {
    await this.cancelAdvance(fleetId);

    if (!durationSeconds) return; // No duration = no auto-advance

    const delayMs = durationSeconds * 1000;
    await queueAdvanceQueue.add(
      "advance",
      { fleetId },
      {
        delay: delayMs,
        jobId: ADVANCE_JOB_ID(fleetId),
        removeOnComplete: true,
      }
    );
  }

  private async cancelAdvance(fleetId: string): Promise<void> {
    const job = await queueAdvanceQueue.getJob(ADVANCE_JOB_ID(fleetId));
    if (job) {
      await job.remove().catch(() => null);
    }
  }
}
