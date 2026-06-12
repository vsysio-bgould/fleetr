import db from "@/lib/db";
import type { IEsiClient } from "@/infra/esi/types";

export interface EsiTokenData {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  scopes: string[];
}

const REFRESH_BUFFER_MS = 60_000; // refresh if expiring within 60 s

export class EsiTokenStore {
  async upsert(characterId: number, data: EsiTokenData): Promise<void> {
    await db.esiToken.upsert({
      where: { characterId },
      update: {
        refreshToken: data.refreshToken,
        accessToken: data.accessToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        scopes: data.scopes,
      },
      create: {
        characterId,
        refreshToken: data.refreshToken,
        accessToken: data.accessToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        scopes: data.scopes,
      },
    });
  }

  async get(characterId: number): Promise<EsiTokenData | null> {
    const token = await db.esiToken.findUnique({ where: { characterId } });
    if (!token) return null;

    return {
      refreshToken: token.refreshToken,
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      scopes: token.scopes as string[],
    };
  }

  /** Returns a valid (non-expired) token, refreshing via ESI SSO if needed. */
  async getOrRefresh(characterId: number, esiClient: IEsiClient): Promise<EsiTokenData | null> {
    const token = await this.get(characterId);
    if (!token) return null;

    const needsRefresh = token.accessTokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;
    if (!needsRefresh) return token;

    const refreshed = await esiClient.refreshAccessToken(token.refreshToken);
    const updated: EsiTokenData = {
      refreshToken: refreshed.refreshToken,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      scopes: refreshed.scopes,
    };
    await this.upsert(characterId, updated);
    return updated;
  }

  async delete(characterId: number): Promise<void> {
    await db.esiToken.delete({ where: { characterId } }).catch(() => null);
  }
}
