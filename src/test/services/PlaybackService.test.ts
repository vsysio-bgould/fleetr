import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaybackService } from "@/services/PlaybackService";
import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  default: {
    playback: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
    queueEntry: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    fleet: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/broadcast", () => ({
  broadcastToFleet: vi.fn().mockResolvedValue(undefined),
}));

// Mock BullMQ queue — no actual Redis connection
vi.mock("@/lib/queue", () => ({
  queueAdvanceQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
    getJob: vi.fn().mockResolvedValue(null),
  },
}));

describe("PlaybackService", () => {
  let service: PlaybackService;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    service = new PlaybackService();
  });

  describe("setTrack", () => {
    it("upserts playback, schedules advance, and broadcasts fleet:now-playing", async () => {
      const db = (await import("@/lib/db")).default;
      const { queueAdvanceQueue } = await import("@/lib/queue");
      const { broadcastToFleet } = await import("@/lib/broadcast");

      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        id: "entry-uuid",
        mediaId: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up",
        thumbnailUrl: null,
        duration: 212,
        fleetId: "fleet-uuid",
      } as never);

      await service.setTrack("fleet-uuid", "entry-uuid", 12345);

      expect(db.playback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fleetId: "fleet-uuid" },
          update: expect.objectContaining({
            queueEntryId: "entry-uuid",
            mediaId: "dQw4w9WgXcQ",
          }),
        })
      );

      expect(queueAdvanceQueue.add).toHaveBeenCalledWith(
        "advance",
        { fleetId: "fleet-uuid" },
        expect.objectContaining({
          delay: 212000,
          jobId: "fleet-advance-fleet-uuid",
        })
      );

      expect(broadcastToFleet).toHaveBeenCalledWith(
        "fleet-uuid",
        expect.objectContaining({
          type: "fleet:now-playing",
          payload: expect.objectContaining({
            queueEntryId: "entry-uuid",
            mediaId: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up",
          }),
        })
      );
    });

    it("does not schedule advance job when duration is null", async () => {
      const db = (await import("@/lib/db")).default;
      const { queueAdvanceQueue } = await import("@/lib/queue");

      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        id: "entry-uuid",
        mediaId: "track-slug",
        title: "Track",
        thumbnailUrl: null,
        duration: null,
        fleetId: "fleet-uuid",
      } as never);

      await service.setTrack("fleet-uuid", "entry-uuid", null);

      expect(queueAdvanceQueue.add).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when entry does not belong to fleet", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        id: "entry-uuid",
        mediaId: "abc",
        title: "Track",
        thumbnailUrl: null,
        duration: 100,
        fleetId: "other-fleet",
      } as never);

      await expect(
        service.setTrack("fleet-uuid", "entry-uuid", 12345)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("setMode", () => {
    it("jumps to the top of the new queue and broadcasts fleet:mode-changed", async () => {
      const db = (await import("@/lib/db")).default;
      const { broadcastToFleet } = await import("@/lib/broadcast");

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({ mode: "CRUISE" } as never);
      vi.mocked(db.queueEntry.findMany).mockResolvedValueOnce([
        {
          id: "battle-entry",
          mediaId: "battle-media",
          title: "Battle Track",
          thumbnailUrl: null,
          duration: 180,
          position: 1.0,
          _count: { votes: 3 },
        },
      ] as never);

      await service.setMode("fleet-uuid", "BATTLE", 12345);

      expect(db.fleet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { mode: "BATTLE" } })
      );
      expect(db.playback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ queueEntryId: "battle-entry" }),
        })
      );
      expect(broadcastToFleet).toHaveBeenCalledWith(
        "fleet-uuid",
        expect.objectContaining({
          type: "fleet:mode-changed",
          mode: "BATTLE",
          nowPlaying: expect.objectContaining({ queueEntryId: "battle-entry" }),
        })
      );
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: "fleet.mode-changed" }),
        })
      );
    });

    it("clears playback and broadcasts null nowPlaying when the new queue is empty", async () => {
      const db = (await import("@/lib/db")).default;
      const { broadcastToFleet } = await import("@/lib/broadcast");

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({ mode: "CRUISE" } as never);
      vi.mocked(db.queueEntry.findMany).mockResolvedValueOnce([] as never);

      await service.setMode("fleet-uuid", "BATTLE", 12345);

      expect(db.playback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ queueEntryId: null }),
        })
      );
      expect(broadcastToFleet).toHaveBeenCalledWith(
        "fleet-uuid",
        expect.objectContaining({
          type: "fleet:mode-changed",
          mode: "BATTLE",
          nowPlaying: null,
        })
      );
    });

    it("picks the highest-voted entry as the new reference", async () => {
      const db = (await import("@/lib/db")).default;

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({ mode: "BATTLE" } as never);
      vi.mocked(db.queueEntry.findMany).mockResolvedValueOnce([
        { id: "low", mediaId: "m1", title: "Low", thumbnailUrl: null, duration: 100, position: 1.0, _count: { votes: 1 } },
        { id: "high", mediaId: "m2", title: "High", thumbnailUrl: null, duration: 100, position: 2.0, _count: { votes: 5 } },
      ] as never);

      await service.setMode("fleet-uuid", "CRUISE", null);

      expect(db.playback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ queueEntryId: "high" }),
        })
      );
    });

    it("remembers and restores playback position when switching back to a mode", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-13T00:10:42.000Z"));
      const db = (await import("@/lib/db")).default;
      const { queueAdvanceQueue } = await import("@/lib/queue");
      const { broadcastToFleet } = await import("@/lib/broadcast");

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({ mode: "BATTLE" } as never);
      vi.mocked(db.playback.findUnique).mockResolvedValueOnce({
        queueEntryId: "battle-entry",
        startedAt: new Date("2026-06-13T00:10:00.000Z"),
        cruiseQueueEntryId: "cruise-entry",
        cruiseOffsetSeconds: 42,
        battleQueueEntryId: null,
        battleOffsetSeconds: 0,
      } as never);
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        id: "cruise-entry",
        mediaId: "cruise-media",
        title: "Cruise Track",
        thumbnailUrl: null,
        duration: 120,
        fleetId: "fleet-uuid",
        queue: "CRUISE",
        removedAt: null,
      } as never);

      await service.setMode("fleet-uuid", "CRUISE", 12345);

      expect(db.playback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            queueEntryId: "cruise-entry",
            battleQueueEntryId: "battle-entry",
            battleOffsetSeconds: 42,
          }),
        })
      );
      expect(queueAdvanceQueue.add).toHaveBeenCalledWith(
        "advance",
        { fleetId: "fleet-uuid" },
        expect.objectContaining({ delay: 78000 })
      );
      expect(broadcastToFleet).toHaveBeenCalledWith(
        "fleet-uuid",
        expect.objectContaining({
          type: "fleet:mode-changed",
          mode: "CRUISE",
          nowPlaying: expect.objectContaining({
            queueEntryId: "cruise-entry",
            startedAt: "2026-06-13T00:10:00.000Z",
          }),
        })
      );
    });
  });

  describe("advance", () => {
    it("sets the top entry as the fleet reference", async () => {
      const db = (await import("@/lib/db")).default;

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({ mode: "CRUISE" } as never);
      vi.mocked(db.queueEntry.findMany).mockResolvedValueOnce([
        {
          id: "next-entry",
          mediaId: "next-media-id",
          title: "Next",
          thumbnailUrl: null,
          duration: 180,
          position: 1.0,
          _count: { votes: 0 },
        },
      ] as never);

      // For setTrack called internally
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        id: "next-entry",
        mediaId: "next-media-id",
        title: "Next",
        thumbnailUrl: null,
        duration: 180,
        fleetId: "fleet-uuid",
      } as never);

      const result = await service.advance("fleet-uuid", null);
      expect(result.nowPlaying).toBe(true);
    });

    it("clears playback and broadcasts null when queue is empty", async () => {
      const db = (await import("@/lib/db")).default;
      const { broadcastToFleet } = await import("@/lib/broadcast");

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({ mode: "CRUISE" } as never);
      vi.mocked(db.queueEntry.findMany).mockResolvedValueOnce([] as never);

      const result = await service.advance("fleet-uuid", null);
      expect(result.nowPlaying).toBe(false);
      expect(db.playback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            queueEntryId: null,
            mediaId: null,
            startedAt: null,
          }),
        })
      );
      expect(broadcastToFleet).toHaveBeenCalledWith(
        "fleet-uuid",
        expect.objectContaining({ type: "fleet:now-playing", payload: null })
      );
    });
  });
});
