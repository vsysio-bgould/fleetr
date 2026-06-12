import type { IMediaClient, MediaMetadata } from "@/infra/media/types";
import { EmbeddingDisabledError, ValidationError } from "@/lib/errors";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// Regex patterns for YouTube URL formats
const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

export class YouTubeClient implements IMediaClient {
  private readonly apiKey: string;

  constructor() {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error("YOUTUBE_API_KEY is not set");
    this.apiKey = key;
  }

  async validateAndFetch(url: string): Promise<MediaMetadata> {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new ValidationError("Invalid YouTube URL");
    }

    const apiUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    apiUrl.searchParams.set("id", videoId);
    apiUrl.searchParams.set("part", "snippet,contentDetails,status");
    apiUrl.searchParams.set("key", this.apiKey);

    const res = await fetch(apiUrl.toString());
    if (!res.ok) {
      throw new ValidationError(`YouTube API error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.items?.length) {
      throw new ValidationError("Video not found or unavailable");
    }

    const item = data.items[0];

    if (!item.status?.embeddable) {
      throw new EmbeddingDisabledError("YouTube");
    }

    const title: string = item.snippet?.title ?? "Unknown";
    const thumbnailUrl: string | null =
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null;

    const durationIso: string | null = item.contentDetails?.duration ?? null;
    const duration = durationIso ? parseIsoDuration(durationIso) : null;

    return {
      mediaId: videoId,
      title,
      thumbnailUrl,
      duration,
      platform: "YOUTUBE",
    };
  }
}

export function extractVideoId(url: string): string | null {
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseIsoDuration(iso: string): number | null {
  // ISO 8601 duration: PT4M33S, PT1H2M10S, etc.
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}
