import db from "@/lib/db";
import { queueAdvanceQueue } from "@/lib/queue";
import { NotFoundError } from "@/lib/errors";
import logger from "@/lib/logger";
import { broadcastToFleet } from "@/lib/broadcast";
import type { FleetMode } from "@prisma/client";

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
      select: { mediaId: true, duration: true, fleetId: true },
    });

    if (!entry || entry.fleetId !== fleetId) {
      throw new NotFoundError("Queue entry");
    }

    const startedAt = new Date();

    await db.playback.upsert({
      where: { fleetId },
      update: { queueEntryId, mediaId: entry.mediaId, startedAt },
      create: { fleetId, queueEntryId, mediaId: entry.mediaId, startedAt },
    });

    // Cancel any existing advance job and schedule a new one
    await this.scheduleAdvance(fleetId, entry.duration);

    logger.info(
      { fleetId, queueEntryId, initiatedBy },
      "Playback track set"
    );
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

    const nextEntry = await db.queueEntry.findFirst({
      where: { fleetId, queue: fleet.mode, removedAt: null },
      orderBy: [{ position: "asc" }],
      // TODO: exclude already-played entries (needs plays table in future)
    });

    if (!nextEntry) {
      // Clear playback reference
      await db.playback.upsert({
        where: { fleetId },
        update: { queueEntryId: null, mediaId: null, startedAt: null },
        create: { fleetId },
      });
      await this.cancelAdvance(fleetId);
      logger.info({ fleetId, initiatedBy }, "Queue exhausted, playback cleared");
      return { nowPlaying: false };
    }

    await this.setTrack(fleetId, nextEntry.id, initiatedBy);
    return { nowPlaying: true };
  }

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

    // Cancel current advance job, start from the new queue
    await this.cancelAdvance(fleetId);

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
      payload: { volume },
    });
    logger.debug({ fleetId, volume }, "Fleet volume changed");
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
