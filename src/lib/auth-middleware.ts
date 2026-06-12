import { NextRequest } from "next/server";
import db from "@/lib/db";
import { UnauthorizedError } from "@/lib/errors";

export interface AuthContext {
  characterId: number;
  apiTokenId: string;
}

/**
 * Validate the API bearer token from Authorization header or fleetr_token cookie.
 * Returns the authenticated context or throws UnauthorizedError.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const token = extractToken(req);

  if (!token) {
    throw new UnauthorizedError("No authentication token provided");
  }

  const apiToken = await db.apiToken.findUnique({
    where: { id: token },
    select: { id: true, characterId: true, expiresAt: true },
  });

  if (!apiToken) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (apiToken.expiresAt < new Date()) {
    throw new UnauthorizedError("Token has expired");
  }

  // Update lastUsedAt without blocking the request
  db.apiToken
    .update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => null);

  return { characterId: apiToken.characterId, apiTokenId: apiToken.id };
}

function extractToken(req: NextRequest): string | null {
  // Prefer Authorization header (Bearer token)
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  // Fall back to httpOnly cookie (browser clients)
  const cookie = req.cookies.get("fleetr_token");
  if (cookie?.value) {
    return cookie.value;
  }

  return null;
}
