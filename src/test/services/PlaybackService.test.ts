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
    },
    fleet: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
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
    vi.clearAllMocks();
    service = new PlaybackService();
  });

  describe("setTrack", () => {
    it("upserts playback and schedules advance job when duration is set", async () => {
      const db = (await import("@/lib/db")).default;
      const { queueAdvanceQueue } = await import("@/lib/queue");

      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        mediaId: "dQw4w9WgXcQ",
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
          jobId: "fleet-advance:fleet-uuid",
        })
      );
    });

    it("does not schedule advance job when duration is null", async () => {
      const db = (await import("@/lib/db")).default;
      const { queueAdvanceQueue } = await import("@/lib/queue");

      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        mediaId: "track-slug",
        duration: null,
        fleetId: "fleet-uuid",
      } as never);

      await service.setTrack("fleet-uuid", "entry-uuid", null);

      expect(queueAdvanceQueue.add).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when entry does not belong to fleet", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        mediaId: "abc",
        duration: 100,
        fleetId: "other-fleet",
      } as never);

      await expect(
        service.setTrack("fleet-uuid", "entry-uuid", 12345)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("setMode", () => {
    it("updates fleet mode and cancels the existing advance job", async () => {
      const db = (await import("@/lib/db")).default;
      const { queueAdvanceQueue } = await import("@/lib/queue");

      const mockJob = { remove: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(queueAdvanceQueue.getJob).mockResolvedValueOnce(mockJob as never);

      await service.setMode("fleet-uuid", "BATTLE", 12345);

      expect(db.fleet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { mode: "BATTLE" },
        })
      );
      expect(mockJob.remove).toHaveBeenCalledOnce();
    });
  });

  describe("advance", () => {
    it("sets the next entry as the fleet reference", async () => {
      const db = (await import("@/lib/db")).default;

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
        mode: "CRUISE",
        disbandedAt: null,
      } as never);
      vi.mocked(db.playback.findUnique).mockResolvedValueOnce({
        queueEntryId: "current-entry",
      } as never);
      vi.mocked(db.queueEntry.findFirst).mockResolvedValueOnce({
        id: "next-entry",
        mediaId: "next-media-id",
        duration: 180,
        fleetId: "fleet-uuid",
      } as never);

      // For setTrack called internally
      vi.mocked(db.queueEntry.findUnique).mockResolvedValueOnce({
        mediaId: "next-media-id",
        duration: 180,
        fleetId: "fleet-uuid",
      } as never);

      const result = await service.advance("fleet-uuid", null);
      expect(result.nowPlaying).toBe(true);
    });

    it("clears playback and returns nowPlaying:false when queue is empty", async () => {
      const db = (await import("@/lib/db")).default;

      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
        mode: "CRUISE",
        disbandedAt: null,
      } as never);
      vi.mocked(db.playback.findUnique).mockResolvedValueOnce({ queueEntryId: null } as never);
      vi.mocked(db.queueEntry.findFirst).mockResolvedValueOnce(null);

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
    });
  });
});
