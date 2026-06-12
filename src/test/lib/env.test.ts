import { describe, it, expect, beforeEach } from "vitest";
import { _resetEnv, getEnv } from "@/lib/env";

const VALID_ENV = {
  DATABASE_URL: "mysql://user:pass@localhost:3306/fleetr",
  REDIS_URL: "redis://localhost:6379",
  ESI_CLIENT_ID: "client-id",
  ESI_CLIENT_SECRET: "client-secret",
  ESI_CALLBACK_URL: "http://localhost:3000/api/v1/auth/callback",
  PARTYKIT_SECRET: "a-secret-that-is-long-enough",
  APP_URL: "http://localhost:3000",
  NODE_ENV: "test",
};

describe("getEnv", () => {
  beforeEach(() => {
    _resetEnv();
    // Clear all env vars set by previous tests
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
  });

  it("returns validated env when all required vars are present", () => {
    Object.assign(process.env, VALID_ENV);
    const env = getEnv();
    expect(env.ESI_CLIENT_ID).toBe("client-id");
    expect(env.NODE_ENV).toBe("test");
  });

  it("throws when a required var is missing", () => {
    const partial = { ...VALID_ENV };
    delete (partial as Partial<typeof VALID_ENV>).DATABASE_URL;
    Object.assign(process.env, partial);
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it("throws when APP_URL is not a valid URL", () => {
    Object.assign(process.env, { ...VALID_ENV, APP_URL: "not-a-url" });
    expect(() => getEnv()).toThrow();
  });

  it("caches the result after first call", () => {
    Object.assign(process.env, VALID_ENV);
    const first = getEnv();
    const second = getEnv();
    expect(first).toBe(second);
  });
});
