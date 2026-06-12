import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  NotInFleetError,
  FleetExpiredError,
  EmbeddingDisabledError,
  PlatformMismatchError,
  AlreadyVotedError,
  ScopeNotGrantedError,
  EsiUnavailableError,
  ValidationError,
  RateLimitError,
} from "@/lib/errors";

describe("AppError hierarchy", () => {
  it("AppError has code, message, and statusCode", () => {
    const err = new AppError("TEST", "test message", 400);
    expect(err.code).toBe("TEST");
    expect(err.message).toBe("test message");
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });

  it.each([
    [new NotFoundError("Fleet"), "NOT_FOUND", 404],
    [new ForbiddenError(), "FORBIDDEN", 403],
    [new UnauthorizedError(), "UNAUTHORIZED", 401],
    [new NotInFleetError(), "NOT_IN_FLEET", 403],
    [new FleetExpiredError(), "FLEET_EXPIRED", 410],
    [new EmbeddingDisabledError("YouTube"), "EMBEDDING_DISABLED", 422],
    [new PlatformMismatchError("YouTube", "SoundCloud"), "PLATFORM_MISMATCH", 422],
    [new AlreadyVotedError(), "ALREADY_VOTED", 409],
    [new ScopeNotGrantedError("esi-location.read_location.v1", "LOCATION"), "SCOPE_NOT_GRANTED", 403],
    [new EsiUnavailableError(), "ESI_UNAVAILABLE", 503],
    [new ValidationError("invalid"), "VALIDATION_ERROR", 422],
    [new RateLimitError(), "RATE_LIMITED", 429],
  ])("%s has code %s and status %s", (err, code, status) => {
    expect(err.code).toBe(code);
    expect(err.statusCode).toBe(status);
    expect(err).toBeInstanceOf(AppError);
  });

  it("ValidationError carries field-level errors", () => {
    const fields = { url: ["Invalid URL format"] };
    const err = new ValidationError("invalid input", fields);
    expect(err.fields).toEqual(fields);
  });

  it("ScopeNotGrantedError exposes scope and gate", () => {
    const err = new ScopeNotGrantedError("esi-location.read_location.v1", "LOCATION");
    expect(err.scope).toBe("esi-location.read_location.v1");
    expect(err.gate).toBe("LOCATION");
  });
});
