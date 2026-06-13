import { NextRequest } from "next/server";
import { ok, errorResponse } from "@/lib/api-response";
import { SCOPE_GATES } from "@/config/scope-gates";
import db from "@/lib/db";

// Auth is optional — return default preference if character is unknown
async function getCharacterId(req: NextRequest): Promise<number | null> {
  try {
    const { requireAuth } = await import("@/lib/auth-middleware");
    const auth = await requireAuth(req);
    return auth.characterId;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const characterId = await getCharacterId(req);

    const preference =
      characterId != null
        ? await db.userScopePreference.findUnique({
            where: { characterId },
            select: { scopes: true },
          })
        : null;

    const byScope = new Map<
      string,
      {
        scope: string;
        required: boolean;
        label: string;
        description: string;
        consequence: string;
      }
    >();

    for (const gate of Object.values(SCOPE_GATES)) {
      const existing = byScope.get(gate.scope);
      const required = gate.key === "FLEET_MEMBERSHIP" || gate.key === "FLEET_MEMBERS";
      if (!existing) {
        byScope.set(gate.scope, {
          scope: gate.scope,
          required,
          label: gate.label,
          description: gate.consequence,
          consequence: gate.consequence,
        });
        continue;
      }
      existing.required = existing.required || required;
    }

    return ok({
      scopes: Array.from(byScope.values()),
      preference: preference ? (preference.scopes as string[]) : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
