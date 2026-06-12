import { describe, it, expect } from "vitest";
import { extractVideoId } from "@/infra/media/YouTubeClient";

describe("extractVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?list=PLxxx&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts video ID from %s", (url, expected) => {
    expect(extractVideoId(url)).toBe(expected);
  });

  it.each([
    ["https://soundcloud.com/artist/track"],
    ["https://vimeo.com/123456"],
    ["not-a-url"],
    ["https://youtube.com/channel/UCxxxx"],
  ])("returns null for non-YouTube URL: %s", (url) => {
    expect(extractVideoId(url)).toBeNull();
  });
});
