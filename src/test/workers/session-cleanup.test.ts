import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import workerDef from "@/workers/session-cleanup.worker";

vi.mock("@/lib/db", () => ({
  default: {
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    apiToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  },
}));

function makeJob(data: object = {}): Job {
  return { id: "test-job", data } as Job;
}

describe("session-cleanup worker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes expired sessions and tokens", async () => {
    const db = (await import("@/lib/db")).default;

    await workerDef.process(makeJob());

    expect(db.session.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { expiresAt: { lt: expect.any(Date) } } })
    );
    expect(db.apiToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { expiresAt: { lt: expect.any(Date) } } })
    );
  });
});
