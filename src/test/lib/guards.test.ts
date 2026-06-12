import { describe, it, expect } from "vitest";
import { requireFc, requireScope } from "@/lib/guards";
import { ForbiddenError, ScopeNotGrantedError } from "@/lib/errors";
import type { SessionContext } from "@/lib/guards";
import { SessionRole } from "@prisma/client";

function makeCtx(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    characterId: 100,
    apiTokenId: "token-uuid",
    sessionId: "session-uuid",
    fleetId: "fleet-uuid",
    role: SessionRole.LINE_MEMBER,
    grantedScopes: [],
    ...overrides,
  };
}

describe("requireFc", () => {
  it("passes for FLEET_COMMANDER", () => {
    expect(() => requireFc(makeCtx({ role: SessionRole.FLEET_COMMANDER }))).not.toThrow();
  });

  it("passes for FC_DELEGATE", () => {
    expect(() => requireFc(makeCtx({ role: SessionRole.FC_DELEGATE }))).not.toThrow();
  });

  it("throws ForbiddenError for LINE_MEMBER", () => {
    expect(() => requireFc(makeCtx({ role: SessionRole.LINE_MEMBER }))).toThrow(ForbiddenError);
  });
});

describe("requireScope", () => {
  it("passes when the required scope is granted", () => {
    const ctx = makeCtx({ grantedScopes: ["esi-location.read_location.v1"] });
    expect(() => requireScope(ctx, "LOCATION")).not.toThrow();
  });

  it("throws ScopeNotGrantedError when scope is absent", () => {
    const ctx = makeCtx({ grantedScopes: [] });
    expect(() => requireScope(ctx, "LOCATION")).toThrow(ScopeNotGrantedError);
  });

  it("ScopeNotGrantedError carries the scope and gate", () => {
    const ctx = makeCtx({ grantedScopes: [] });
    try {
      requireScope(ctx, "FLEET_MEMBERSHIP");
    } catch (err) {
      expect(err).toBeInstanceOf(ScopeNotGrantedError);
      const e = err as ScopeNotGrantedError;
      expect(e.scope).toBe("esi-fleets.read_fleet.v1");
      expect(e.gate).toBe("FLEET_MEMBERSHIP");
    }
  });
});
