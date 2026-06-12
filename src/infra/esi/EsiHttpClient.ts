import { EsiUnavailableError } from "@/lib/errors";
import logger from "@/lib/logger";
import { EsiErrorBudget } from "@/infra/esi/EsiErrorBudget";
import { EsiCache } from "@/infra/esi/EsiCache";

const ESI_BASE = "https://esi.evetech.net/latest";
const USER_AGENT = "Fleetr/0.1 (contact: your-contact@example.com)";

export interface EsiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string;
  /** Skip ETag caching for this request (e.g. character-scoped endpoints with tokens). */
  noCache?: boolean;
}

export interface EsiResponse<T> {
  data: T;
  status: number;
  etag?: string;
  expires?: string;
  errorLimitRemain?: number;
  errorLimitReset?: number;
  fromCache?: boolean;
}

export class EsiHttpClient {
  private readonly budget: EsiErrorBudget;
  private readonly cache: EsiCache;

  constructor(budget?: EsiErrorBudget, cache?: EsiCache) {
    this.budget = budget ?? new EsiErrorBudget();
    this.cache = cache ?? new EsiCache();
  }

  async request<T>(
    path: string,
    options: EsiRequestOptions = {}
  ): Promise<EsiResponse<T>> {
    const { method = "GET", body, accessToken, noCache = false } = options;

    // Proactive throttle check — throws if error budget is exhausted
    await this.budget.check();

    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    // ETag caching — only for GET requests without auth (public ESI) or explicitly cached
    const cacheKey = `${method}:${path}`;
    const useCache = method === "GET" && !noCache && !accessToken;

    if (useCache) {
      const etag = await this.cache.getEtag(cacheKey);
      if (etag) {
        headers["If-None-Match"] = etag;
      }
    }

    let response: Response;
    try {
      response = await fetch(`${ESI_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      logger.error({ err, path }, "ESI network error");
      throw new EsiUnavailableError("ESI network request failed");
    }

    // Record error budget headers after every response
    const errorLimitRemain = parseIntHeader(response.headers.get("X-ESI-Error-Limit-Remain"));
    const errorLimitReset = parseIntHeader(response.headers.get("X-ESI-Error-Limit-Reset"));
    if (errorLimitRemain !== undefined && errorLimitReset !== undefined) {
      // Fire-and-forget — don't block the response on this
      void this.budget.record(errorLimitRemain, errorLimitReset).catch((err) => {
        logger.warn({ err }, "Failed to record ESI error budget");
      });
    }

    // 304 Not Modified — return cached data
    if (response.status === 304 && useCache) {
      const cached = await this.cache.getCachedData(cacheKey);
      if (cached !== null) {
        logger.debug({ path }, "ESI cache hit (304)");
        return {
          data: cached as T,
          status: 304,
          fromCache: true,
        };
      }
      // Cache miss despite 304 — fall through and re-fetch without ETag
    }

    if (response.status === 503 || response.status === 504) {
      throw new EsiUnavailableError(`ESI returned ${response.status}`);
    }

    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => "");
      logger.warn({ status: response.status, path, body: text }, "ESI error response");
      throw new EsiUnavailableError(`ESI error ${response.status}: ${text}`);
    }

    const data = response.status === 404 || response.status === 204 ? null : await response.json();
    const etag = response.headers.get("ETag") ?? undefined;
    const expires = response.headers.get("Expires") ?? undefined;

    // Store in ETag cache for public GET responses
    if (useCache && etag && data !== null) {
      const ttl = parseTtlFromExpires(expires);
      void this.cache.store(cacheKey, etag, data, ttl).catch((err) => {
        logger.warn({ err, path }, "Failed to store ESI cache entry");
      });
    }

    return {
      data: data as T,
      status: response.status,
      etag,
      expires,
      errorLimitRemain,
      errorLimitReset,
    };
  }
}

function parseIntHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}

function parseTtlFromExpires(expires: string | undefined): number | undefined {
  if (!expires) return undefined;
  const expiresMs = Date.parse(expires);
  if (isNaN(expiresMs)) return undefined;
  const seconds = Math.floor((expiresMs - Date.now()) / 1000);
  return seconds > 0 ? seconds : undefined;
}
