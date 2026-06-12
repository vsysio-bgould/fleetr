import redis from "@/lib/redis";
import { RateLimitError } from "@/lib/errors";
import type { NextRequest } from "next/server";

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Namespace prefix for the Redis key (e.g. "api:queue:submit") */
  namespace: string;
}

/**
 * Sliding-window rate limiter backed by Redis INCR + EXPIRE.
 * Throws RateLimitError when the limit is exceeded.
 *
 * Key format: ratelimit:{namespace}:{identifier}
 * where identifier is the characterId (authenticated) or IP address (anonymous).
 */
export async function rateLimit(
  req: NextRequest,
  characterId: number | null,
  options: RateLimitOptions
): Promise<void> {
  const identifier = characterId
    ? `char:${characterId}`
    : `ip:${req.headers.get("x-forwarded-for") ?? "unknown"}`;

  const key = `ratelimit:${options.namespace}:${identifier}`;

  const current = await redis.incr(key);

  if (current === 1) {
    // First request in window — set expiry
    await redis.expire(key, options.windowSeconds);
  }

  if (current > options.limit) {
    const ttl = await redis.ttl(key);
    throw new RateLimitError(`Rate limit exceeded. Retry after ${ttl}s`);
  }
}

/** Preset configs for common endpoints. */
export const RATE_LIMITS = {
  /** Queue submission: 10 per minute per character */
  queueSubmit: { limit: 10, windowSeconds: 60, namespace: "queue:submit" },
  /** Auth: 5 per minute per IP */
  auth: { limit: 5, windowSeconds: 60, namespace: "auth" },
  /** FC actions (mode, advance): 30 per minute */
  fcAction: { limit: 30, windowSeconds: 60, namespace: "fc:action" },
  /** Vote: 60 per minute per character */
  vote: { limit: 60, windowSeconds: 60, namespace: "queue:vote" },
} as const satisfies Record<string, RateLimitOptions>;
