import db from "@/lib/db";

export interface EsiTokenData {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  scopes: string[];
}

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

  async delete(characterId: number): Promise<void> {
    await db.esiToken.delete({ where: { characterId } }).catch(() => null);
  }
}
