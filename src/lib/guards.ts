import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireAuth, type AuthContext } from "@/lib/auth-middleware";
import { ForbiddenError, NotFoundError, ScopeNotGrantedError } from "@/lib/errors";
import type { SessionRole } from "@prisma/client";
import { SCOPE_GATES, type ScopeGateKey } from "@/config/scope-gates";
import { canManageDelegation, hasFleetControl } from "@/lib/roles";

export interface SessionContext extends AuthContext {
  sessionId: string;
  fleetId: string;
  role: SessionRole;
  grantedScopes: string[];
  isOperator: boolean;
}

export async function requireSession(
  req: NextRequest,
  fleetId: string
): Promise<SessionContext> {
  const auth = await requireAuth(req);

  const [session, user] = await Promise.all([
    db.session.findUnique({
      where: {
        fleetId_characterId: {
          fleetId,
          characterId: auth.characterId,
        },
      },
      select: { id: true, role: true, expiresAt: true, grantedScopes: true },
    }),
    db.user.findUnique({
      where: { characterId: auth.characterId },
      select: {
        isOperator: true,
        esiToken: { select: { scopes: true } },
      },
    }),
  ]);

  const isOperator = user?.isOperator ?? false;

  if (!session && !isOperator) {
    throw new ForbiddenError("You are not a member of this fleet");
  }

  if (session && session.expiresAt < new Date() && !isOperator) {
    throw new ForbiddenError("Your fleet session has expired");
  }

  if (!session) {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { id: true, disbandedAt: true, expiresAt: true },
    });

    if (!fleet) throw new NotFoundError("Fleet");
    if (fleet.disbandedAt || (fleet.expiresAt && fleet.expiresAt < new Date())) {
      throw new ForbiddenError("Fleet is not active");
    }
  }

  return {
    ...auth,
    sessionId: session?.id ?? `operator:${auth.characterId}:${fleetId}`,
    fleetId,
    role: isOperator ? "FLEET_BOSS" : session?.role ?? "LINE_MEMBER",
    grantedScopes:
      (session?.grantedScopes as string[] | undefined) ??
      ((user?.esiToken?.scopes as string[] | undefined) ?? []),
    isOperator,
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
  if (!ctx.isOperator && !hasFleetControl(ctx.role)) {
    throw new ForbiddenError("This action requires fleet control access");
  }
}

export function requireFleetCommander(ctx: SessionContext): void {
  if (!ctx.isOperator && !canManageDelegation(ctx.role)) {
    throw new ForbiddenError(
      "This action requires Fleet Boss or Fleet Commander access"
    );
  }
}

export const requireFleetControl = requireFc;
export const requireDelegationManager = requireFleetCommander;

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
