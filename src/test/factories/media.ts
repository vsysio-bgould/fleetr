import { vi } from "vitest";
import type { IMediaClient } from "@/infra/media/types";

export function createMockYouTubeClient(): IMediaClient {
  return {
    validateAndFetch: vi.fn().mockResolvedValue({
      mediaId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      duration: 212,
      platform: "YOUTUBE",
    }),
  };
}

export function createMockSoundCloudClient(): IMediaClient {
  return {
    validateAndFetch: vi.fn().mockResolvedValue({
      mediaId: "test-artist/test-track",
      title: "Test Track",
      thumbnailUrl: null,
      duration: null,
      platform: "SOUNDCLOUD",
    }),
  };
}
