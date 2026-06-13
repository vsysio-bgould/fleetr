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

const ADVANCE_JOB_ID = (fleetId: string) => `fleet-advance-${fleetId}`;

interface PlayableEntry {
  id: string;
  mediaId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
}

interface ModeBookmark {
  queueEntryId: string | null;
  offsetSeconds: number;
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
    initiatedBy: number | null,
    options: { broadcast?: boolean } = {}
  ): Promise<ServerMessage> {
    const entry = await db.queueEntry.findUnique({
      where: { id: queueEntryId },
      select: { ...PLAYABLE_SELECT, fleetId: true },
    });

    if (!entry || entry.fleetId !== fleetId) {
      throw new NotFoundError("Queue entry");
    }

    const nowPlaying = await this.applyTrack(fleetId, entry);

    const message = {
      type: "fleet:now-playing",
      payload: nowPlaying,
    } satisfies ServerMessage;

    if (options.broadcast !== false) {
      void broadcastToFleet(fleetId, message);
    }

    logger.info({ fleetId, queueEntryId, initiatedBy }, "Playback track set");
    return message;
  }

  async advance(
    fleetId: string,
    initiatedBy: number | null,
    options: { broadcast?: boolean } = {}
  ): Promise<{ nowPlaying: boolean; message: ServerMessage }> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { mode: true },
    });
    if (!fleet) throw new NotFoundError("Fleet");

    const nextEntry = await this.topOfQueue(fleetId, fleet.mode);

    if (!nextEntry) {
      await this.clearTrack(fleetId);

      const message = {
        type: "fleet:now-playing",
        payload: null,
      } satisfies ServerMessage;

      if (options.broadcast !== false) {
        void broadcastToFleet(fleetId, message);
      }

      logger.info({ fleetId, initiatedBy }, "Queue exhausted, playback cleared");
      return { nowPlaying: false, message };
    }

    const message = await this.setTrack(fleetId, nextEntry.id, initiatedBy, options);
    return { nowPlaying: true, message };
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
    initiatedBy: number | null,
    options: { broadcast?: boolean } = {}
  ): Promise<ServerMessage> {
    const previous = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { mode: true },
    });
    if (!previous) throw new NotFoundError("Fleet");

    const currentPlayback = await db.playback.findUnique({
      where: { fleetId },
      select: {
        queueEntryId: true,
        startedAt: true,
        cruiseQueueEntryId: true,
        cruiseOffsetSeconds: true,
        battleQueueEntryId: true,
        battleOffsetSeconds: true,
      },
    });
    const outgoingBookmark = this.createBookmark(currentPlayback);
    const incomingBookmark = this.bookmarkForMode(mode, currentPlayback);

    await db.fleet.update({ where: { id: fleetId }, data: { mode } });

    const savedEntry = incomingBookmark.queueEntryId
      ? await this.findPlayableEntry(fleetId, mode, incomingBookmark.queueEntryId)
      : null;
    const topEntry = savedEntry ?? await this.topOfQueue(fleetId, mode);
    const offsetSeconds = savedEntry ? incomingBookmark.offsetSeconds : 0;

    let nowPlaying: FleetNowPlaying | null = null;
    if (topEntry) {
      nowPlaying = await this.applyTrack(fleetId, topEntry, {
        offsetSeconds,
        modeBookmark: { mode: previous.mode, bookmark: outgoingBookmark },
      });
    } else {
      await this.clearTrack(fleetId, {
        mode: previous.mode,
        bookmark: outgoingBookmark,
      });
    }

    const message = {
      type: "fleet:mode-changed",
      mode,
      nowPlaying,
    } satisfies ServerMessage;

    if (options.broadcast !== false) {
      void broadcastToFleet(fleetId, message);
    }

    await db.auditLog.create({
      data: {
        event: "fleet.mode-changed",
        actor: initiatedBy !== null ? String(initiatedBy) : "system",
        payload: { fleetId, oldMode: previous.mode, newMode: mode },
      },
    });

    logger.info({ fleetId, mode, initiatedBy }, "Fleet mode changed");
    return message;
  }

  async setVolume(
    fleetId: string,
    volume: number,
    options: { broadcast?: boolean } = {}
  ): Promise<ServerMessage> {
    // Volume is runtime state only — no DB write needed.
    const message = {
      type: "fleet:volume-changed",
      volume,
    } satisfies ServerMessage;
    if (options.broadcast !== false) {
      void broadcastToFleet(fleetId, message);
    }
    logger.debug({ fleetId, volume }, "Fleet volume changed");
    return message;
  }

  /** Persist the reference track + schedule auto-advance. Does not broadcast. */
  private async applyTrack(
    fleetId: string,
    entry: PlayableEntry,
    options: {
      offsetSeconds?: number;
      modeBookmark?: { mode: FleetMode; bookmark: ModeBookmark };
    } = {}
  ): Promise<FleetNowPlaying> {
    const offsetSeconds = Math.max(0, Math.floor(options.offsetSeconds ?? 0));
    const startedAt = new Date(Date.now() - offsetSeconds * 1000);
    const bookmarkData = options.modeBookmark
      ? this.bookmarkUpdate(options.modeBookmark.mode, options.modeBookmark.bookmark)
      : {};

    await db.playback.upsert({
      where: { fleetId },
      update: { queueEntryId: entry.id, mediaId: entry.mediaId, startedAt, ...bookmarkData },
      create: {
        fleetId,
        queueEntryId: entry.id,
        mediaId: entry.mediaId,
        startedAt,
        ...bookmarkData,
      },
    });

    await this.scheduleAdvance(fleetId, entry.duration, offsetSeconds);

    return {
      queueEntryId: entry.id,
      mediaId: entry.mediaId,
      title: entry.title,
      thumbnailUrl: entry.thumbnailUrl,
      duration: entry.duration,
      startedAt: startedAt.toISOString(),
    };
  }

  private async clearTrack(
    fleetId: string,
    modeBookmark?: { mode: FleetMode; bookmark: ModeBookmark }
  ): Promise<void> {
    const bookmarkData = modeBookmark
      ? this.bookmarkUpdate(modeBookmark.mode, modeBookmark.bookmark)
      : {};
    await db.playback.upsert({
      where: { fleetId },
      update: { queueEntryId: null, mediaId: null, startedAt: null, ...bookmarkData },
      create: { fleetId, ...bookmarkData },
    });
    await this.cancelAdvance(fleetId);
  }

  /** Snapshot the outgoing mode so switching back can resume near the same point. */
  private createBookmark(
    playback: { queueEntryId: string | null; startedAt: Date | null } | null
  ): ModeBookmark {
    if (!playback?.queueEntryId || !playback.startedAt) {
      return { queueEntryId: null, offsetSeconds: 0 };
    }
    const offsetSeconds = Math.max(
      0,
      Math.floor((Date.now() - playback.startedAt.getTime()) / 1000)
    );
    return { queueEntryId: playback.queueEntryId, offsetSeconds };
  }

  private bookmarkForMode(
    mode: FleetMode,
    playback: {
      cruiseQueueEntryId: string | null;
      cruiseOffsetSeconds: number;
      battleQueueEntryId: string | null;
      battleOffsetSeconds: number;
    } | null
  ): ModeBookmark {
    if (!playback) return { queueEntryId: null, offsetSeconds: 0 };
    return mode === "CRUISE"
      ? {
          queueEntryId: playback.cruiseQueueEntryId,
          offsetSeconds: playback.cruiseOffsetSeconds,
        }
      : {
          queueEntryId: playback.battleQueueEntryId,
          offsetSeconds: playback.battleOffsetSeconds,
        };
  }

  private bookmarkUpdate(mode: FleetMode, bookmark: ModeBookmark) {
    return mode === "CRUISE"
      ? {
          cruiseQueueEntryId: bookmark.queueEntryId,
          cruiseOffsetSeconds: bookmark.offsetSeconds,
        }
      : {
          battleQueueEntryId: bookmark.queueEntryId,
          battleOffsetSeconds: bookmark.offsetSeconds,
        };
  }

  /** Top of a queue: votes desc, position asc - same order the queue UI shows. */
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

  private async findPlayableEntry(
    fleetId: string,
    mode: FleetMode,
    queueEntryId: string
  ): Promise<PlayableEntry | null> {
    const queue = mode as string as QueueType;
    const entry = await db.queueEntry.findUnique({
      where: { id: queueEntryId },
      select: { ...PLAYABLE_SELECT, fleetId: true, queue: true, removedAt: true },
    });
    if (!entry || entry.fleetId !== fleetId || entry.queue !== queue || entry.removedAt) {
      return null;
    }
    return entry;
  }

  private async scheduleAdvance(
    fleetId: string,
    durationSeconds: number | null,
    offsetSeconds = 0
  ): Promise<void> {
    await this.cancelAdvance(fleetId);

    if (!durationSeconds) return; // No duration = no auto-advance

    const delayMs = Math.max(0, (durationSeconds - offsetSeconds) * 1000);
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
