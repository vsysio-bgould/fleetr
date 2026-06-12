import type { IMediaClient, MediaMetadata } from "@/infra/media/types";
import { ValidationError } from "@/lib/errors";

const OEMBED_URL = "https://soundcloud.com/oembed";

export class SoundCloudClient implements IMediaClient {
  async validateAndFetch(url: string): Promise<MediaMetadata> {
    if (!isSoundCloudUrl(url)) {
      throw new ValidationError("Invalid SoundCloud URL");
    }

    const apiUrl = new URL(OEMBED_URL);
    apiUrl.searchParams.set("url", url);
    apiUrl.searchParams.set("format", "json");

    const res = await fetch(apiUrl.toString());

    if (res.status === 404) {
      throw new ValidationError("SoundCloud track not found or private");
    }

    if (!res.ok) {
      throw new ValidationError(`SoundCloud oEmbed error: ${res.status}`);
    }

    const data = await res.json();

    // Extract track slug from URL for a stable mediaId
    const mediaId = extractTrackSlug(url);
    const title: string = data.title ?? "Unknown";
    const thumbnailUrl: string | null = data.thumbnail_url ?? null;

    // oEmbed does not return duration; duration field is null until
    // we switch to the SoundCloud API (requires client_id registration)
    const duration: number | null = null;

    return {
      mediaId,
      title,
      thumbnailUrl,
      duration,
      platform: "SOUNDCLOUD",
    };
  }
}

function isSoundCloudUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "soundcloud.com" ||
      parsed.hostname === "www.soundcloud.com" ||
      parsed.hostname === "m.soundcloud.com"
    );
  } catch {
    return false;
  }
}

function extractTrackSlug(url: string): string {
  try {
    const parsed = new URL(url);
    // pathname: /artist/track-name → "artist/track-name"
    return parsed.pathname.replace(/^\//, "").replace(/\/$/, "");
  } catch {
    return url;
  }
}
