import crypto from "crypto";
import db from "@/lib/db";
import redis from "@/lib/redis";
import logger from "@/lib/logger";
import { UnauthorizedError } from "@/lib/errors";
import type { IEsiClient } from "@/infra/esi/types";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";

const ESI_AUTHORIZE_URL = "https://login.eveonline.com/v2/oauth/authorize";
const OAUTH_STATE_TTL_SECONDS = 300; // 5 minutes
const API_TOKEN_EXPIRY_DAYS = parseInt(
  process.env.API_TOKEN_EXPIRY_DAYS ?? "30",
  10
);

interface OAuthState {
  returnUrl: string;
  scopes: string[];
  nonce: string;
}

export class AuthService {
  constructor(
    private readonly esiClient: IEsiClient,
    private readonly tokenStore: EsiTokenStore
  ) {}

  async beginFlow(
    scopes: string[],
    returnUrl: string
  ): Promise<{ redirectUrl: string }> {
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    const stateData: OAuthState = { returnUrl, scopes, nonce };
    await redis.setex(
      `oauth:state:${state}`,
      OAUTH_STATE_TTL_SECONDS,
      JSON.stringify(stateData)
    );

    const clientId = process.env.ESI_CLIENT_ID!;
    const callbackUrl = process.env.ESI_CALLBACK_URL!;

    const params = new URLSearchParams({
      response_type: "code",
      redirect_uri: callbackUrl,
      client_id: clientId,
      scope: scopes.join(" "),
      state,
    });

    return { redirectUrl: `${ESI_AUTHORIZE_URL}?${params.toString()}` };
  }

  async handleCallback(
    code: string,
    stateKey: string
  ): Promise<{ apiToken: string; characterId: number }> {
    const raw = await redis.get(`oauth:state:${stateKey}`);
    if (!raw) {
      throw new UnauthorizedError("OAuth state expired or invalid");
    }
    await redis.del(`oauth:state:${stateKey}`);

    void (JSON.parse(raw) as OAuthState);

    const tokenResponse = await this.esiClient.exchangeCode(code);

    // Upsert user record
    await db.user.upsert({
      where: { characterId: tokenResponse.characterId },
      update: { characterName: tokenResponse.characterName },
      create: {
        characterId: tokenResponse.characterId,
        characterName: tokenResponse.characterName,
      },
    });

    // Store ESI token
    const expiresAt = new Date(
      Date.now() + tokenResponse.expiresIn * 1000
    );
    await this.tokenStore.upsert(tokenResponse.characterId, {
      refreshToken: tokenResponse.refreshToken,
      accessToken: tokenResponse.accessToken,
      accessTokenExpiresAt: expiresAt,
      scopes: tokenResponse.scopes,
    });

    // Persist scope preference
    await db.userScopePreference.upsert({
      where: { characterId: tokenResponse.characterId },
      update: { scopes: tokenResponse.scopes },
      create: {
        characterId: tokenResponse.characterId,
        scopes: tokenResponse.scopes,
      },
    });

    // Issue API token
    const apiToken = await this.issueApiToken(tokenResponse.characterId);

    logger.info(
      { characterId: tokenResponse.characterId },
      "Auth callback completed"
    );

    return { apiToken, characterId: tokenResponse.characterId };
  }

  async logout(apiTokenId: string): Promise<void> {
    await db.apiToken.delete({ where: { id: apiTokenId } }).catch(() => null);
  }

  private async issueApiToken(characterId: number): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + API_TOKEN_EXPIRY_DAYS);

    const token = await db.apiToken.create({
      data: { characterId, expiresAt },
    });

    return token.id;
  }
}
