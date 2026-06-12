import redis from "@/lib/redis";
import logger from "@/lib/logger";
import { EsiUnavailableError } from "@/lib/errors";

const BUDGET_KEY = "esi:error-budget";
const THROTTLE_KEY = "esi:throttled-until";

// 5-tier behaviour based on X-ESI-Error-Limit-Remain header value:
//   > 50        NORMAL       — pass through unrestricted
//   26–50       WARN         — log warning, pass through
//   11–25       THROTTLE     — log warning, add 500ms delay before request
//   1–10        EMERGENCY    — reject immediately, propagate to caller
//   0           HALT         — reject immediately, set throttle key until reset

type BudgetTier = "normal" | "warn" | "throttle" | "emergency" | "halt";

function getTier(remain: number): BudgetTier {
  if (remain > 50) return "normal";
  if (remain > 25) return "warn";
  if (remain > 10) return "throttle";
  if (remain > 0) return "emergency";
  return "halt";
}

export class EsiErrorBudget {
  /**
   * Record the error budget headers from an ESI response.
   * Called after every ESI request.
   */
  async record(remain: number, resetSeconds: number): Promise<void> {
    const tier = getTier(remain);
    const pipeline = redis.pipeline();
    pipeline.set(BUDGET_KEY, remain);

    if (tier === "halt") {
      pipeline.set(THROTTLE_KEY, "1", "EX", resetSeconds);
      logger.error({ remain, resetSeconds }, "ESI error budget at 0 — halting all ESI requests until window reset");
    } else if (tier === "emergency") {
      pipeline.set(THROTTLE_KEY, "1", "EX", resetSeconds);
      logger.warn({ remain, resetSeconds }, "ESI error budget critical — engaging emergency reject");
    } else {
      // Clear any stale throttle if budget has recovered above emergency threshold
      pipeline.del(THROTTLE_KEY);
      if (tier === "warn") {
        logger.warn({ remain }, "ESI error budget low");
      } else if (tier === "throttle") {
        logger.warn({ remain }, "ESI error budget reduced — throttle mode active");
      }
    }

    await pipeline.exec();
  }

  /**
   * Check whether we should block this request and apply any delay.
   * Throws EsiUnavailableError if in emergency/halt tier.
   * Adds a 500ms delay in throttle tier.
   */
  async check(): Promise<void> {
    const throttled = await redis.get(THROTTLE_KEY);
    if (throttled) {
      const ttl = await redis.ttl(THROTTLE_KEY);
      throw new EsiUnavailableError(`ESI error budget exhausted — retrying in ${ttl}s`);
    }

    const val = await redis.get(BUDGET_KEY);
    if (val === null) return;

    const remain = parseInt(val, 10);
    const tier = getTier(remain);

    if (tier === "emergency" || tier === "halt") {
      throw new EsiUnavailableError(`ESI error budget critically low (${remain} remaining)`);
    }

    if (tier === "throttle") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /** Current remaining budget (for diagnostics). */
  async remaining(): Promise<number | null> {
    const val = await redis.get(BUDGET_KEY);
    return val !== null ? parseInt(val, 10) : null;
  }
}
