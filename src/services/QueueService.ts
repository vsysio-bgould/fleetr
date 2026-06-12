import db from "@/lib/db";
import type { IMediaClient } from "@/infra/media/types";
import {
  AlreadyVotedError,
  ForbiddenError,
  NotFoundError,
  PlatformMismatchError,
  ValidationError,
} from "@/lib/errors";
import type { MediaSource, QueueType } from "@prisma/client";
import { broadcastToFleet } from "@/lib/broadcast";
import type { ServerMessage } from "@/config/party-messages";
import logger from "@/lib/logger";

export interface QueueEntryRow {
  id: string;
  fleetId: string;
  queue: QueueType;
  mediaUrl: string;
  mediaId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
  submittedBy: number;
  position: number;
  votes: number;
  hasVoted?: boolean;
}

export class QueueService {
  constructor(
    private readonly youtubeClient: IMediaClient,
    private readonly soundCloudClient: IMediaClient
  ) {}

  async validate(
    fleetId: string,
    mediaUrl: string,
    queue: QueueType
  ): Promise<{
    mediaId: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number | null;
    platform: string;
  }> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { mediaSource: true },
    });
    if (!fleet) throw new NotFoundError("Fleet");

    this.assertPlatformMatch(mediaUrl, fleet.mediaSource);

    const client = this.getClient(fleet.mediaSource);
    const metadata = await client.validateAndFetch(mediaUrl);

    return metadata;
  }

  async submit(
    fleetId: string,
    characterId: number,
    mediaUrl: string,
    queue: QueueType
  ): Promise<QueueEntryRow> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { mediaSource: true },
    });
    if (!fleet) throw new NotFoundError("Fleet");

    this.assertPlatformMatch(mediaUrl, fleet.mediaSource);

    const client = this.getClient(fleet.mediaSource);
    const metadata = await client.validateAndFetch(mediaUrl);

    // Get next position
    const last = await db.queueEntry.findFirst({
      where: { fleetId, queue, removedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + 1.0;

    const entry = await db.queueEntry.create({
      data: {
        fleetId,
        queue,
        mediaUrl,
        mediaId: metadata.mediaId,
        title: metadata.title,
        thumbnailUrl: metadata.thumbnailUrl,
        duration: metadata.duration,
        submittedBy: characterId,
        position,
      },
    });

    logger.info(
      { fleetId, characterId, entryId: entry.id, queue },
      "Queue entry submitted"
    );

    void broadcastToFleet(fleetId, {
      type: "queue:entry-added",
      payload: {
        id: entry.id,
        queue: entry.queue,
        mediaId: entry.mediaId,
        title: entry.title,
        thumbnailUrl: entry.thumbnailUrl,
        duration: entry.duration,
        submittedBy: entry.submittedBy,
        position: entry.position,
        votes: 0,
      },
    } satisfies ServerMessage);

    return { ...entry, votes: 0, hasVoted: false };
  }

  async remove(
    fleetId: string,
    entryId: string,
    characterId: number,
    isFC: boolean
  ): Promise<void> {
    const entry = await db.queueEntry.findUnique({
      where: { id: entryId },
      select: { fleetId: true, submittedBy: true, removedAt: true, queue: true },
    });

    if (!entry || entry.fleetId !== fleetId) throw new NotFoundError("Queue entry");
    if (entry.removedAt) throw new NotFoundError("Queue entry");
    if (!isFC && entry.submittedBy !== characterId) {
      throw new ForbiddenError("You can only remove your own entries");
    }

    await db.queueEntry.update({
      where: { id: entryId },
      data: { removedAt: new Date(), removedBy: characterId },
    });

    void broadcastToFleet(fleetId, {
      type: "queue:entry-removed",
      queueEntryId: entryId,
      queue: entry.queue,
    } satisfies ServerMessage);
  }

  async vote(
    fleetId: string,
    entryId: string,
    characterId: number
  ): Promise<number> {
    const entry = await db.queueEntry.findUnique({
      where: { id: entryId },
      select: { fleetId: true, removedAt: true, queue: true },
    });
    if (!entry || entry.fleetId !== fleetId) throw new NotFoundError("Queue entry");
    if (entry.removedAt) throw new NotFoundError("Queue entry");

    const existing = await db.vote.findUnique({
      where: { queueEntryId_characterId: { queueEntryId: entryId, characterId } },
    });
    if (existing) throw new AlreadyVotedError();

    await db.vote.create({ data: { queueEntryId: entryId, characterId } });

    await db.auditLog.create({
      data: {
        event: "queue.vote-cast",
        actor: String(characterId),
        payload: { fleetId, queueEntryId: entryId },
      },
    });

    const votes = await db.vote.count({ where: { queueEntryId: entryId } });

    void broadcastToFleet(fleetId, {
      type: "queue:vote-updated",
      queueEntryId: entryId,
      votes,
      queue: entry.queue,
      voterId: characterId,
      voted: true,
    } satisfies ServerMessage);

    return votes;
  }

  async unvote(
    fleetId: string,
    entryId: string,
    characterId: number
  ): Promise<number> {
    const entry = await db.queueEntry.findUnique({
      where: { id: entryId },
      select: { fleetId: true, queue: true },
    });
    if (!entry || entry.fleetId !== fleetId) throw new NotFoundError("Queue entry");

    await db.vote
      .delete({
        where: { queueEntryId_characterId: { queueEntryId: entryId, characterId } },
      })
      .catch(() => null);

    const votes = await db.vote.count({ where: { queueEntryId: entryId } });

    void broadcastToFleet(fleetId, {
      type: "queue:vote-updated",
      queueEntryId: entryId,
      votes,
      queue: entry.queue,
      voterId: characterId,
      voted: false,
    } satisfies ServerMessage);

    return votes;
  }

  async reorder(
    fleetId: string,
    entryId: string,
    characterId: number,
    position: number
  ): Promise<QueueEntryRow> {
    const entry = await db.queueEntry.findUnique({
      where: { id: entryId },
      select: { fleetId: true, removedAt: true },
    });
    if (!entry || entry.fleetId !== fleetId) throw new NotFoundError("Queue entry");
    if (entry.removedAt) throw new NotFoundError("Queue entry");

    const updated = await db.queueEntry.update({
      where: { id: entryId },
      data: { position },
      include: { votes: true },
    });

    void broadcastToFleet(fleetId, {
      type: "queue:reordered",
      queueEntryId: entryId,
      position: updated.position,
      queue: updated.queue,
    } satisfies ServerMessage);

    return {
      id: updated.id,
      fleetId: updated.fleetId,
      queue: updated.queue,
      mediaUrl: updated.mediaUrl,
      mediaId: updated.mediaId,
      title: updated.title,
      thumbnailUrl: updated.thumbnailUrl,
      duration: updated.duration,
      submittedBy: updated.submittedBy,
      position: updated.position,
      votes: updated.votes.length,
    };
  }

  async list(
    fleetId: string,
    queue: QueueType,
    characterId: number | null,
    limit = 50,
    offset = 0
  ): Promise<QueueEntryRow[]> {
    const entries = await db.queueEntry.findMany({
      where: { fleetId, queue, removedAt: null },
      include: { votes: true },
      orderBy: [{ position: "asc" }],
      take: limit,
      skip: offset,
    });

    return entries
      .map((e) => ({
        id: e.id,
        fleetId: e.fleetId,
        queue: e.queue,
        mediaUrl: e.mediaUrl,
        mediaId: e.mediaId,
        title: e.title,
        thumbnailUrl: e.thumbnailUrl,
        duration: e.duration,
        submittedBy: e.submittedBy,
        position: e.position,
        votes: e.votes.length,
        hasVoted: characterId
          ? e.votes.some((v) => v.characterId === characterId)
          : false,
      }))
      .sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return a.position - b.position;
      });
  }

  private assertPlatformMatch(url: string, mediaSource: MediaSource): void {
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
    const isSoundCloud = url.includes("soundcloud.com");

    if (mediaSource === "YOUTUBE" && !isYouTube) {
      const platform = isSoundCloud ? "SoundCloud" : "unknown";
      throw new PlatformMismatchError("YouTube", platform);
    }

    if (mediaSource === "SOUNDCLOUD" && !isSoundCloud) {
      const platform = isYouTube ? "YouTube" : "unknown";
      throw new PlatformMismatchError("SoundCloud", platform);
    }
  }

  private getClient(mediaSource: MediaSource): IMediaClient {
    if (mediaSource === "YOUTUBE") return this.youtubeClient;
    if (mediaSource === "SOUNDCLOUD") return this.soundCloudClient;
    throw new ValidationError("CUSTOM media source is not yet supported");
  }
}
