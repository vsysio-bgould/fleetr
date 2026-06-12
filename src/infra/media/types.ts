export interface MediaMetadata {
  mediaId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null; // seconds
  platform: "YOUTUBE" | "SOUNDCLOUD";
}

export interface IMediaClient {
  validateAndFetch(url: string): Promise<MediaMetadata>;
}
