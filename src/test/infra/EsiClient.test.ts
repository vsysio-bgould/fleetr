import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { EsiClient } from "@/infra/esi/EsiClient";

vi.mock("@/infra/esi/EsiHttpClient", () => ({
  EsiHttpClient: vi.fn().mockImplementation(() => ({})),
}));

describe("EsiClient token verification", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.stubEnv("ESI_CLIENT_ID", "fleetr-client");
    vi.stubEnv("ESI_CLIENT_SECRET", "secret");
  });

  it("verifies the EVE SSO access token before trusting character claims", async () => {
    const { token, jwks } = await makeToken();
    const jwksServer = await serveJwks(jwks);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/v2/oauth/token")) {
        return jsonResponse({
          access_token: token,
          refresh_token: "refresh-token",
          expires_in: 1200,
        });
      }
      if (url.endsWith("/.well-known/oauth-authorization-server")) {
        return jsonResponse({
          issuer: "https://login.eveonline.com/",
          jwks_uri: jwksServer.url,
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await new EsiClient().exchangeCode("code");

      expect(result.characterId).toBe(12345);
      expect(result.characterName).toBe("Zylithi");
      expect(result.scopes).toEqual(["esi-fleets.read_fleet.v1"]);
    } finally {
      await jwksServer.close();
    }
  });

  it("rejects tokens missing the static EVE Online audience", async () => {
    const { token, jwks } = await makeToken({ audience: ["fleetr-client"] });
    const jwksServer = await serveJwks(jwks);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/v2/oauth/token")) {
        return jsonResponse({
          access_token: token,
          refresh_token: "refresh-token",
          expires_in: 1200,
        });
      }
      if (url.endsWith("/.well-known/oauth-authorization-server")) {
        return jsonResponse({
          issuer: "https://login.eveonline.com/",
          jwks_uri: jwksServer.url,
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    try {
      await expect(new EsiClient().exchangeCode("code")).rejects.toThrow(
        "EVE SSO token audience is invalid"
      );
    } finally {
      await jwksServer.close();
    }
  });
});

let keyMaterial:
  | {
      privateKey: KeyLike | Uint8Array;
      jwks: { keys: Array<Record<string, unknown>> };
    }
  | null = null;

async function makeToken(options: { audience?: string[] } = {}) {
  if (!keyMaterial) {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    keyMaterial = {
      privateKey: privateKey as KeyLike,
      jwks: { keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }] },
    };
  }
  const material = keyMaterial;

  const token = await new SignJWT({
    scp: ["esi-fleets.read_fleet.v1"],
    sub: "CHARACTER:EVE:12345",
    azp: "fleetr-client",
    name: "Zylithi",
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://login.eveonline.com/")
    .setAudience(options.audience ?? ["fleetr-client", "EVE Online"])
    .setExpirationTime("5m")
    .sign(material.privateKey);
  return { token, jwks: material.jwks };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function serveJwks(jwks: { keys: Array<Record<string, unknown>> }) {
  const server: Server = createServer((request, response) => {
    if (request.url !== "/jwks") {
      response.writeHead(404);
      response.end();
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(jwks));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/jwks`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
