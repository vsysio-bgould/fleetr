import db from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export interface UserProfile {
  characterId: number;
  characterName: string;
  isOperator: boolean;
  activeSessions: Array<{
    fleetId: string;
    role: string;
  }>;
  grantedScopes: string[];
}

export class UserService {
  async getMe(characterId: number): Promise<UserProfile> {
    const user = await db.user.findUnique({
      where: { characterId },
      include: {
        sessions: {
          where: {
            expiresAt: { gt: new Date() },
          },
          select: { fleetId: true, role: true },
        },
        esiToken: { select: { scopes: true } },
      },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    return {
      characterId: user.characterId,
      characterName: user.characterName,
      isOperator: user.isOperator,
      activeSessions: user.sessions.map((s) => ({
        fleetId: s.fleetId,
        role: s.role,
      })),
      grantedScopes: (user.esiToken?.scopes as string[]) ?? [],
    };
  }

  async updateScopePreference(
    characterId: number,
    scopes: string[]
  ): Promise<void> {
    await db.userScopePreference.upsert({
      where: { characterId },
      update: { scopes },
      create: { characterId, scopes },
    });
  }
}
