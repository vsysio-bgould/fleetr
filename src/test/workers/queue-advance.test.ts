import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import workerDef from "@/workers/queue-advance.worker";

vi.mock("@/lib/db", () => ({
  default: {
    fleet: { findUnique: vi.fn() },
    playback: { findUnique: vi.fn() },
    queueEntry: { findFirst: vi.fn() },
  },
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", mockFetch);

function makeJob(data: object, id: string): Job {
  return { id, data } as Job;
}

describe("queue-advance worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("PARTYKIT_SECRET", "test-secret");
  });

  it("discards stale jobs with mismatched IDs", async () => {
    const job = makeJob({ fleetId: "fleet-uuid" }, "fleet-advance-other-fleet");
    await workerDef.process(job);
    // Should not call DB or fetch since it exited early
    const db = (await import("@/lib/db")).default;
    expect(db.fleet.findUnique).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips disbanded fleets", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
      mode: "CRUISE",
      disbandedAt: new Date(),
    } as never);

    const job = makeJob({ fleetId: "fleet-uuid" }, "fleet-advance-fleet-uuid");
    await workerDef.process(job);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls internal API to advance when next entry exists", async () => {
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
    } as never);

    const job = makeJob({ fleetId: "fleet-uuid" }, "fleet-advance-fleet-uuid");
    await workerDef.process(job);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/internal/fleets/fleet-uuid/playback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ queueEntryId: "next-entry", initiatedBy: null }),
      })
    );
  });

  it("calls internal API to clear playback when queue is empty", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
      mode: "CRUISE",
      disbandedAt: null,
    } as never);
    vi.mocked(db.playback.findUnique).mockResolvedValueOnce({
      queueEntryId: null,
    } as never);
    vi.mocked(db.queueEntry.findFirst).mockResolvedValueOnce(null);

    const job = makeJob({ fleetId: "fleet-uuid" }, "fleet-advance-fleet-uuid");
    await workerDef.process(job);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ queueEntryId: null, initiatedBy: null }),
      })
    );
  });
});
