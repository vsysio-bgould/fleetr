import db from "@/lib/db";

export type AdvisoryKey = "youtube-premium" | "soundcloud-quality" | "location-scope";

export interface Advisory {
  key: AdvisoryKey;
  title: string;
  body: string;
  permanent: boolean;
  lastShownAt?: Date;
}

const ADVISORY_META: Record<AdvisoryKey, { title: string; body: string }> = {
  "youtube-premium": {
    title: "YouTube Premium recommended",
    body: "Some YouTube tracks skip ads automatically for Premium subscribers. Without Premium, your client may pause during ad breaks.",
  },
  "soundcloud-quality": {
    title: "SoundCloud audio quality",
    body: "SoundCloud streams at 128 kbps for free accounts. Go Premium for 256 kbps audio.",
  },
  "location-scope": {
    title: "Location scope not granted",
    body: "Grant the Location scope to show your solar system in the member roster. Re-authenticate from your profile to enable this.",
  },
};

export class AdvisoryService {
  private static readonly RECENCY_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check whether an advisory should be shown.
   * Returns false if permanently dismissed or dismissed within the last 24 hours.
   */
  async shouldShow(characterId: number, key: AdvisoryKey): Promise<boolean> {
    const record = await db.advisoryDismissal.findUnique({
      where: { characterId_key: { characterId, key } },
    });
    if (!record) return true;
    if (record.permanent) return false;
    return Date.now() - record.lastShownAt.getTime() > AdvisoryService.RECENCY_MS;
  }

  /** Return all advisories that should currently be shown for a character. */
  async list(characterId: number): Promise<Advisory[]> {
    const dismissals = await db.advisoryDismissal.findMany({
      where: { characterId },
    });

    const now = Date.now();
    const dismissedMap = new Map(dismissals.map((d) => [d.key, d]));

    return (Object.keys(ADVISORY_META) as AdvisoryKey[]).filter((key) => {
      const record = dismissedMap.get(key);
      if (!record) return true;
      if (record.permanent) return false;
      return now - record.lastShownAt.getTime() > AdvisoryService.RECENCY_MS;
    }).map((key) => {
      const meta = ADVISORY_META[key];
      const record = dismissedMap.get(key);
      return {
        key,
        title: meta.title,
        body: meta.body,
        permanent: false,
        lastShownAt: record?.lastShownAt,
      };
    });
  }

  /** Dismiss an advisory for a character. */
  async dismiss(
    characterId: number,
    key: AdvisoryKey,
    permanent: boolean
  ): Promise<void> {
    await db.advisoryDismissal.upsert({
      where: { characterId_key: { characterId, key } },
      create: { characterId, key, permanent },
      update: { permanent, lastShownAt: new Date() },
    });
  }

  /** Clear a specific dismissal so the advisory shows again. */
  async undismiss(characterId: number, key: AdvisoryKey): Promise<void> {
    await db.advisoryDismissal.deleteMany({
      where: { characterId, key },
    });
  }
}
