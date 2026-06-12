import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireAuth, type AuthContext } from "@/lib/auth-middleware";
import { ForbiddenError, NotFoundError, ScopeNotGrantedError } from "@/lib/errors";
import type { SessionRole } from "@prisma/client";
import { SCOPE_GATES, type ScopeGateKey } from "@/config/scope-gates";

export interface SessionContext extends AuthContext {
  sessionId: string;
  fleetId: string;
  role: SessionRole;
  grantedScopes: string[];
}

export async function requireSession(
  req: NextRequest,
  fleetId: string
): Promise<SessionContext> {
  const auth = await requireAuth(req);

  const session = await db.session.findUnique({
    where: {
      fleetId_characterId: {
        fleetId,
        characterId: auth.characterId,
      },
    },
    select: { id: true, role: true, expiresAt: true, grantedScopes: true },
  });

  if (!session) {
    throw new ForbiddenError("You are not a member of this fleet");
  }

  if (session.expiresAt < new Date()) {
    throw new ForbiddenError("Your fleet session has expired");
  }

  return {
    ...auth,
    sessionId: session.id,
    fleetId,
    role: session.role,
    grantedScopes: session.grantedScopes as string[],
  };
}

/**
 * Assert that the session has the scope required by the given gate key.
 * Throws ScopeNotGrantedError if the scope is absent — the client should
 * surface a ScopePrompt asking the user to re-authenticate with additional scopes.
 */
export function requireScope(ctx: SessionContext, gate: ScopeGateKey): void {
  const { scope } = SCOPE_GATES[gate];
  if (!ctx.grantedScopes.includes(scope)) {
    throw new ScopeNotGrantedError(scope, gate);
  }
}

export function requireFc(ctx: SessionContext): void {
  if (ctx.role !== "FLEET_COMMANDER" && ctx.role !== "FC_DELEGATE") {
    throw new ForbiddenError("This action requires Fleet Commander access");
  }
}

export function requireFleetCommander(ctx: SessionContext): void {
  if (ctx.role !== "FLEET_COMMANDER") {
    throw new ForbiddenError(
      "This action requires the Fleet Commander role (not delegate)"
    );
  }
}

export async function requireOperator(req: NextRequest): Promise<AuthContext> {
  const auth = await requireAuth(req);

  const user = await db.user.findUnique({
    where: { characterId: auth.characterId },
    select: { isOperator: true },
  });

  if (!user) {
    throw new NotFoundError("User");
  }

  if (!user.isOperator) {
    throw new ForbiddenError("Operator access required");
  }

  return auth;
}
