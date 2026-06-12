import { describe, expect, it } from "vitest";
import { bullMqJobId } from "@/lib/bullmq";

describe("bullMqJobId", () => {
  it("encodes colons from dynamic job id fragments", () => {
    expect(bullMqJobId("fc-presence", "fleet:123")).toBe("fc-presence-fleet_3A123");
  });

  it("keeps simple ids readable", () => {
    expect(bullMqJobId("esi-refresh", 12345)).toBe("esi-refresh-12345");
  });
});
