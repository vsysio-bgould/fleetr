export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class NotInFleetError extends AppError {
  constructor() {
    super("NOT_IN_FLEET", "You are not a member of this EVE fleet", 403);
  }
}

export class FleetExpiredError extends AppError {
  constructor() {
    super("FLEET_EXPIRED", "This fleet has expired or been disbanded", 410);
  }
}

export class EmbeddingDisabledError extends AppError {
  constructor(platform: string) {
    super(
      "EMBEDDING_DISABLED",
      `This ${platform} video cannot be embedded`,
      422
    );
  }
}

export class PlatformMismatchError extends AppError {
  constructor(expected: string, got: string) {
    super(
      "PLATFORM_MISMATCH",
      `This fleet uses ${expected} — got a ${got} URL`,
      422
    );
  }
}

export class AlreadyVotedError extends AppError {
  constructor() {
    super("ALREADY_VOTED", "You have already voted for this entry", 409);
  }
}

export class ScopeNotGrantedError extends AppError {
  constructor(public readonly scope: string, public readonly gate: string) {
    super(
      "SCOPE_NOT_GRANTED",
      `ESI scope not granted: ${scope}`,
      403
    );
  }
}

export class EsiUnavailableError extends AppError {
  constructor(message = "ESI is currently unavailable") {
    super("ESI_UNAVAILABLE", message, 503);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string[]>
  ) {
    super("VALIDATION_ERROR", message, 422);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super("RATE_LIMITED", message, 429);
  }
}
