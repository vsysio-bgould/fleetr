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

    const scopes = Object.values(SCOPE_GATES).map((gate) => ({
      scope: gate.scope,
      required: gate.key === "FLEET_MEMBERSHIP",
      label: gate.label,
      description: gate.consequence,
      consequence: gate.consequence,
    }));

    return ok({
      scopes,
      preference: preference ? (preference.scopes as string[]) : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
