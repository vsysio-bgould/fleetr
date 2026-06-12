import type { Job } from "bullmq";
import type { WorkerDefinition } from "@/workers/types";
import db from "@/lib/db";
import logger from "@/lib/logger";

interface EsiTokenRefreshPayload {
  /** Specific character to refresh; omit to scan for expiring tokens. */
  characterId?: number;
}

const definition: WorkerDefinition<EsiTokenRefreshPayload> = {
  queueName: "esi-token-refresh",
  concurrency: 3,

  async process(job: Job<EsiTokenRefreshPayload>) {
    const { characterId } = job.data;

    // Scan mode: fan out a refresh job per token expiring within 10 minutes.
    if (!characterId) {
      const { esiTokenRefreshQueue } = await import("@/lib/queue");
      const soon = new Date(Date.now() + 10 * 60 * 1000);
      const tokens = await db.esiToken.findMany({
        where: { accessTokenExpiresAt: { lt: soon } },
        select: { characterId: true },
      });
      await Promise.all(
        tokens.map((t) =>
          esiTokenRefreshQueue.add(
            "refresh",
            { characterId: t.characterId },
            { jobId: `esi-refresh-${t.characterId}` }
          )
        )
      );
      logger.debug({ count: tokens.length }, "esi-token-refresh: scan queued refreshes");
      return;
    }

    const esiToken = await db.esiToken.findUnique({
      where: { characterId },
    });

    if (!esiToken) {
      logger.warn({ characterId }, "esi-token-refresh: no token found, skipping");
      return;
    }

    // Only refresh if within 5 minutes of expiry
    const expiresAt = esiToken.accessTokenExpiresAt;
    const msUntilExpiry = expiresAt.getTime() - Date.now();
    if (msUntilExpiry > 5 * 60 * 1000) {
      logger.debug({ characterId, msUntilExpiry }, "esi-token-refresh: token still valid, skipping");
      return;
    }

    const clientId = process.env.ESI_CLIENT_ID ?? "";
    const clientSecret = process.env.ESI_CLIENT_SECRET ?? "";
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch("https://login.eveonline.com/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: esiToken.refreshToken,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (body.error === "invalid_grant") {
        // Refresh token is revoked — delete the stored token so we don't retry
        await db.esiToken.delete({ where: { characterId } }).catch(() => null);
        logger.warn({ characterId }, "esi-token-refresh: invalid_grant — token deleted");
      } else {
        logger.error({ characterId, status: res.status }, "esi-token-refresh: ESI refresh failed");
      }
      await db.auditLog.create({
        data: {
          event: "esi.token-refresh-failed",
          actor: "system",
          payload: { characterId, reason: body.error ?? `http_${res.status}` },
        },
      }).catch(() => null);
      return;
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    await db.esiToken.update({
      where: { characterId },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    logger.info({ characterId }, "esi-token-refresh: token refreshed successfully");
  },
};

export default definition;
