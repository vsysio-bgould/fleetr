import redis from "@/lib/redis";
import logger from "@/lib/logger";

const CACHE_PREFIX = "esi:cache:";
const DEFAULT_TTL_SECONDS = 60;

interface CacheEntry {
  etag: string;
  data: unknown;
  cachedAt: number;
}

/**
 * Redis-backed ETag cache for ESI responses.
 *
 * On GET: returns stored ETag to send as If-None-Match.
 * On 304: returns cached data without re-parsing.
 * On 200 with new ETag: stores fresh data.
 */
export class EsiCache {
  private key(path: string): string {
    return `${CACHE_PREFIX}${path}`;
  }

  async getEtag(path: string): Promise<string | null> {
    const raw = await redis.get(this.key(path));
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as CacheEntry;
      return entry.etag;
    } catch {
      return null;
    }
  }

  async getCachedData(path: string): Promise<unknown | null> {
    const raw = await redis.get(this.key(path));
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as CacheEntry;
      return entry.data;
    } catch {
      return null;
    }
  }

  async store(path: string, etag: string, data: unknown, ttlSeconds?: number): Promise<void> {
    const entry: CacheEntry = { etag, data, cachedAt: Date.now() };
    const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS;
    await redis.set(this.key(path), JSON.stringify(entry), "EX", ttl);
    logger.debug({ path, etag, ttl }, "ESI cache stored");
  }

  async invalidate(path: string): Promise<void> {
    await redis.del(this.key(path));
  }
}
