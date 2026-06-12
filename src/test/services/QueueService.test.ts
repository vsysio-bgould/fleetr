import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueueService } from "@/services/QueueService";
import {
  createMockYouTubeClient,
  createMockSoundCloudClient,
} from "@/test/factories/media";
import {
  AlreadyVotedError,
  PlatformMismatchError,
} from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  default: {
    fleet: {
      findUnique: vi.fn(),
    },
    playback: {
      findUnique: vi.fn().mockResolvedValue({ queueEntryId: "current-entry" }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    queueEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    vote: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(1),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/broadcast", () => ({ broadcastToFleet: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/queue", () => ({
  queueAdvanceQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
    getJob: vi.fn().mockResolvedValue(null),
  },
}));

describe("QueueService", () => {
  let service: QueueService;
  let ytClient: ReturnType<typeof createMockYouTubeClient>;
  let scClient: ReturnType<typeof createMockSoundCloudClient>;

  beforeEach(async () => {
    vi.clearAllMocks();
    ytClient = createMockYouTubeClient();
    scClient = createMockSoundCloudClient();
    service = new QueueService(ytClient, scClient);

    const db = (await import("@/lib/db")).default;
    vi.mocked(db.fleet.findUnique).mockResolvedValue({
      mediaSource: "YOUTUBE",
      mode: "CRUISE",
    } as never);
    vi.mocked(db.queueEntry.create).mockResolvedValue({
      id: "entry-uuid",
      fleetId: "fleet-uuid",
      queue: "CRUISE",
      mediaUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      mediaId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      thumbnailUrl: null,
      duration: 212,
      submittedBy: 12345,
      position: 1.0,
      votes: [],
      downvotes: [],
      removedAt: null,
    } as never);
  });

  describe("validate", () => {
    it("validates a YouTube URL for a YouTube fleet", async () => {
      const result = await service.validate(
        "fleet-uuid",
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "CRUISE"
      );
      expect(result.mediaId).toBe("dQw4w9WgXcQ");
      expect(ytClient.validateAndFetch).toHaveBeenCalledOnce();
    });

    it("throws PlatformMismatchError for SoundCloud URL on YouTube fleet", async () => {
      await expect(
        service.validate("fleet-uuid", "https://soundcloud.com/artist/track", "CRUISE")
      ).rejects.toThrow(PlatformMismatchError);
    });

    it("throws PlatformMismatchError for YouTube URL on SoundCloud fleet", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
        mediaSource: "SOUNDCLOUD",
      } as never);

      await expect(
        service.validate(
          "fleet-uuid",
          "https://youtube.com/watch?v=abc",
          "CRUISE"
        )
      ).rejects.toThrow(PlatformMismatchError);
    });
  });

  describe("submit", () => {
    it("creates a queue entry at position after current last", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findFirst).mockResolvedValueOnce({
        position: 2.0,
      } as never);

      const entry = await service.submit(
        "fleet-uuid",
        12345,
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "CRUISE"
      );

      expect(db.queueEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 3.0 }),
        })
      );
      expect(entry.id).toBe("entry-uuid");
    });

    it("starts at position 1 when queue is empty", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findFirst).mockResolvedValueOnce(null);

      await service.submit(
        "fleet-uuid",
        12345,
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "CRUISE"
      );

      expect(db.queueEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 1.0 }),
        })
      );
    });

    it("sets playback when the active queue was empty and nothing is playing", async () => {
      const db = (await import("@/lib/db")).default;
      const { broadcastToFleet } = await import("@/lib/broadcast");

      vi.mocked(db.queueEntry.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.playback.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        id: "entry-uuid",
        mediaId: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up",
        thumbnailUrl: null,
        duration: 212,
        fleetId: "fleet-uuid",
      } as never);

      await service.submit(
        "fleet-uuid",
        12345,
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "CRUISE"
      );

      expect(db.playback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fleetId: "fleet-uuid" },
          update: expect.objectContaining({ queueEntryId: "entry-uuid" }),
        })
      );
      expect(broadcastToFleet).toHaveBeenCalledWith(
        "fleet-uuid",
        expect.objectContaining({ type: "fleet:now-playing" })
      );
    });
  });

  describe("vote", () => {
    it("creates a vote and returns updated count", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        fleetId: "fleet-uuid",
        removedAt: null,
      } as never);

      const count = await service.vote("fleet-uuid", "entry-uuid", 12345);
      expect(count).toBe(1);
      expect(db.vote.create).toHaveBeenCalledOnce();
    });

    it("throws AlreadyVotedError when vote already exists", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        fleetId: "fleet-uuid",
        removedAt: null,
      } as never);
      vi.mocked(db.vote.findUnique).mockResolvedValueOnce({ id: "existing" } as never);

      await expect(
        service.vote("fleet-uuid", "entry-uuid", 12345)
      ).rejects.toThrow(AlreadyVotedError);
    });
  });

  describe("unvote", () => {
    it("removes the vote and returns updated count", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        fleetId: "fleet-uuid",
      } as never);

      await expect(
        service.unvote("fleet-uuid", "entry-uuid", 12345)
      ).resolves.toBeDefined();
      expect(db.vote.delete).toHaveBeenCalledOnce();
    });
  });

  describe("list", () => {
    it("returns entries sorted votes desc, position asc", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findMany).mockResolvedValueOnce([
        {
          id: "e1",
          fleetId: "fleet-uuid",
          queue: "CRUISE",
          mediaUrl: "u1",
          mediaId: "m1",
          title: "T1",
          thumbnailUrl: null,
          duration: 100,
          submittedBy: 1,
          position: 1.0,
          votes: [{ characterId: 1 }, { characterId: 2 }],
        },
        {
          id: "e2",
          fleetId: "fleet-uuid",
          queue: "CRUISE",
          mediaUrl: "u2",
          mediaId: "m2",
          title: "T2",
          thumbnailUrl: null,
          duration: 200,
          submittedBy: 2,
          position: 2.0,
          votes: [{ characterId: 3 }],
        },
      ] as never);

      const entries = await service.list("fleet-uuid", "CRUISE", null);

      expect(entries[0].id).toBe("e1"); // 2 votes
      expect(entries[1].id).toBe("e2"); // 1 vote
    });

    it("sets hasVoted correctly for the requesting character", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findMany).mockResolvedValueOnce([
        {
          id: "e1",
          fleetId: "fleet-uuid",
          queue: "CRUISE",
          mediaUrl: "u1",
          mediaId: "m1",
          title: "T1",
          thumbnailUrl: null,
          duration: 100,
          submittedBy: 1,
          position: 1.0,
          votes: [{ characterId: 12345 }],
        },
      ] as never);

      const entries = await service.list("fleet-uuid", "CRUISE", 12345);
      expect(entries[0].hasVoted).toBe(true);
    });
  });
});
