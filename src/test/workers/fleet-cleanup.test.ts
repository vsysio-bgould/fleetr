import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import workerDef from "@/workers/fleet-cleanup.worker";

vi.mock("@/lib/db", () => ({
  default: {
    fleet: { findMany: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    vote: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    playback: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    queueEntry: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    fleetDelegate: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    apiToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
}));

function makeJob(data: object): Job {
  return { id: "test-job", data } as Job;
}

describe("fleet-cleanup worker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips deletion when no expired fleets found", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.fleet.findMany).mockResolvedValueOnce([]);

    await workerDef.process(makeJob({}));

    expect(db.fleet.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes in dependency order when expired fleets exist", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.fleet.findMany).mockResolvedValueOnce([
      { id: "fleet-1" },
      { id: "fleet-2" },
    ] as never);

    await workerDef.process(makeJob({ olderThanDays: 7 }));

    const callOrder = [
      db.vote.deleteMany,
      db.playback.deleteMany,
      db.queueEntry.deleteMany,
      db.session.deleteMany,
      db.fleetDelegate.deleteMany,
      db.fleet.deleteMany,
    ];

    for (const fn of callOrder) {
      expect(fn).toHaveBeenCalledOnce();
    }
  });

  it("uses default 7-day cutoff when no olderThanDays provided", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.fleet.findMany).mockResolvedValueOnce([]);

    await workerDef.process(makeJob({}));

    expect(db.fleet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object) })
    );
  });
});
