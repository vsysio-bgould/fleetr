import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { EsiHttpClient } from "@/infra/esi/EsiHttpClient";
import type {
  EsiCharacter,
  EsiFleetInfo,
  EsiFleetMembership,
  EsiTokenResponse,
  IEsiClient,
} from "@/infra/esi/types";
import { EsiUnavailableError } from "@/lib/errors";
import logger from "@/lib/logger";

const ESI_SSO_BASE = "https://login.eveonline.com";
const ESI_SSO_TOKEN_URL = `${ESI_SSO_BASE}/v2/oauth/token`;
const ESI_SSO_METADATA_URL = `${ESI_SSO_BASE}/.well-known/oauth-authorization-server`;
const ESI_AUDIENCE = "EVE Online";

interface EveSsoMetadata {
  issuer: string;
  jwks_uri: string;
}

interface VerifiedEveClaims {
  characterId: number;
  characterName: string;
  scopes: string[];
}

let metadataPromise:
  | Promise<EveSsoMetadata & { jwks: ReturnType<typeof createRemoteJWKSet> }>
  | null = null;

export class EsiClient implements IEsiClient {
  private readonly http: EsiHttpClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    const clientId = process.env.ESI_CLIENT_ID;
    const clientSecret = process.env.ESI_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("ESI_CLIENT_ID and ESI_CLIENT_SECRET must be set");
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.http = new EsiHttpClient();
  }

  async exchangeCode(code: string): Promise<EsiTokenResponse> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    let response: Response;
    try {
      response = await fetch(ESI_SSO_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Host: "login.eveonline.com",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
        }),
      });
    } catch (err) {
      logger.error({ err }, "ESI token exchange network error");
      throw new EsiUnavailableError("ESI SSO token exchange failed");
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn(
        { status: response.status, body: text },
        "ESI token exchange failed"
      );
      throw new EsiUnavailableError(
        `ESI SSO returned ${response.status}: ${text}`
      );
    }

    const body = await response.json();
    const claims = await verifyEveAccessToken(body.access_token as string, this.clientId);

    return {
      accessToken: body.access_token as string,
      refreshToken: body.refresh_token as string,
      expiresIn: body.expires_in as number,
      scopes: claims.scopes,
      characterId: claims.characterId,
      characterName: claims.characterName,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<EsiTokenResponse> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    let response: Response;
    try {
      response = await fetch(ESI_SSO_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Host: "login.eveonline.com",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
    } catch (err) {
      logger.error({ err }, "ESI token refresh network error");
      throw new EsiUnavailableError("ESI SSO token refresh failed");
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn({ status: response.status, body: text }, "ESI token refresh failed");
      throw new EsiUnavailableError(`ESI SSO token refresh returned ${response.status}`);
    }

    const body = await response.json();
    const claims = await verifyEveAccessToken(body.access_token as string, this.clientId);

    return {
      accessToken: body.access_token as string,
      refreshToken: body.refresh_token as string,
      expiresIn: body.expires_in as number,
      scopes: claims.scopes,
      characterId: claims.characterId,
      characterName: claims.characterName,
    };
  }

  async getFleetMembership(
    characterId: number,
    accessToken: string
  ): Promise<EsiFleetMembership | null> {
    const result = await this.http.request<{
      fleet_id: string;
      fleet_boss_id: number;
      role: EsiFleetMembership["role"];
      squad_id?: number;
      wing_id?: number;
    } | null>(`/characters/${characterId}/fleet/`, { accessToken });

    if (!result.data) return null;

    return {
      fleetId: String(result.data.fleet_id),
      fleetBossId: result.data.fleet_boss_id,
      role: result.data.role,
      squadId: result.data.squad_id,
      wingId: result.data.wing_id,
    };
  }

  async getCharacter(characterId: number): Promise<EsiCharacter> {
    const result = await this.http.request<{
      name: string;
      corporation_id: number;
    }>(`/characters/${characterId}/`);

    return {
      name: result.data.name,
      corporationId: result.data.corporation_id,
    };
  }

  async getLocation(
    characterId: number,
    accessToken: string
  ): Promise<{ solarSystemId: number } | null> {
    const result = await this.http.request<{
      solar_system_id: number;
    } | null>(`/characters/${characterId}/location/`, { accessToken, noCache: true });

    if (!result.data) return null;
    return { solarSystemId: result.data.solar_system_id };
  }

  async getSolarSystemName(systemId: number): Promise<string | null> {
    const result = await this.http.request<{ name: string } | null>(
      `/universe/systems/${systemId}/`
    );
    return result.data?.name ?? null;
  }

  async getFleetMembers(
    esiFleetId: string,
    accessToken: string
  ): Promise<Array<{ character_id: number; role: string }>> {
    const result = await this.http.request<
      Array<{ character_id: number; role: string }>
    >(`/fleets/${esiFleetId}/members/`, { accessToken, noCache: true });

    return result.data ?? [];
  }

  async getFleetInfo(
    esiFleetId: string,
    accessToken: string
  ): Promise<EsiFleetInfo> {
    const result = await this.http.request<{
      is_free_move: boolean;
      is_registered: boolean;
      is_voice_enabled: boolean;
      motd: string;
    }>(`/fleets/${esiFleetId}/`, { accessToken, noCache: true });

    return {
      isFreeMove: result.data.is_free_move,
      isRegistered: result.data.is_registered,
      isVoiceEnabled: result.data.is_voice_enabled,
      motd: result.data.motd,
    };
  }

  async updateFleetSettings(
    esiFleetId: string,
    accessToken: string,
    settings: { motd: string; isFreeMove: boolean }
  ): Promise<void> {
    await this.http.request<null>(`/fleets/${esiFleetId}/`, {
      method: "PUT",
      accessToken,
      noCache: true,
      body: {
        motd: settings.motd,
        is_free_move: settings.isFreeMove,
      },
    });
  }
}

async function verifyEveAccessToken(
  accessToken: string,
  clientId: string
): Promise<VerifiedEveClaims> {
  const metadata = await getEveSsoMetadata();

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(accessToken, metadata.jwks, {
      issuer: uniqueIssuers(metadata.issuer),
      audience: clientId,
    });
    payload = result.payload;
  } catch (err) {
    logger.warn({ err }, "EVE SSO JWT verification failed");
    throw new EsiUnavailableError("EVE SSO token verification failed");
  }

  const audiences = toArray(payload.aud);
  if (!audiences.includes(clientId) || !audiences.includes(ESI_AUDIENCE)) {
    throw new EsiUnavailableError("EVE SSO token audience is invalid");
  }

  if (typeof payload.azp === "string" && payload.azp !== clientId) {
    throw new EsiUnavailableError("EVE SSO token authorized party is invalid");
  }

  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const characterId = parseCharacterId(subject);
  const scopes = toArray(payload.scp);

  return {
    characterId,
    characterName: typeof payload.name === "string" ? payload.name : "",
    scopes,
  };
}

async function getEveSsoMetadata() {
  if (!metadataPromise) {
    metadataPromise = fetch(ESI_SSO_METADATA_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new EsiUnavailableError(`EVE SSO metadata returned ${response.status}`);
        }
        const metadata = (await response.json()) as EveSsoMetadata;
        if (!metadata.jwks_uri || !metadata.issuer) {
          throw new EsiUnavailableError("EVE SSO metadata is incomplete");
        }
        return {
          ...metadata,
          jwks: createRemoteJWKSet(new URL(metadata.jwks_uri)),
        };
      })
      .catch((err) => {
        metadataPromise = null;
        throw err;
      });
  }

  return metadataPromise;
}

function uniqueIssuers(metadataIssuer: string): string[] {
  return Array.from(new Set([metadataIssuer, "https://login.eveonline.com/", "login.eveonline.com"]));
}

function parseCharacterId(subject: string): number {
  const characterIdStr = subject.startsWith("CHARACTER:EVE:")
    ? subject.split(":").at(-1)
    : null;
  const characterId = characterIdStr ? parseInt(characterIdStr, 10) : NaN;
  if (!characterId || Number.isNaN(characterId)) {
    throw new EsiUnavailableError("Could not extract character ID from EVE SSO token");
  }
  return characterId;
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}
