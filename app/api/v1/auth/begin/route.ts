import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, errorResponse } from "@/lib/api-response";
import { AuthService } from "@/services/AuthService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { ValidationError } from "@/lib/errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { SCOPE_GATES } from "@/config/scope-gates";

const bodySchema = z.object({
  scopes: z.array(z.string()).min(1),
  returnUrl: z.string().optional().default("/"),
});

const KNOWN_SCOPES = new Set<string>(Object.values(SCOPE_GATES).map((gate) => gate.scope));
const REQUIRED_SCOPES = new Set<string>(
  Object.values(SCOPE_GATES)
    .filter((gate) => gate.key === "FLEET_MEMBERSHIP" || gate.key === "FLEET_MEMBERS")
    .map((gate) => gate.scope)
);

export async function POST(req: NextRequest) {
  try {
    await rateLimit(req, null, RATE_LIMITS.auth);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const requestedScopes = Array.from(new Set(parsed.data.scopes));
    const unknownScopes = requestedScopes.filter((scope) => !KNOWN_SCOPES.has(scope));
    if (unknownScopes.length > 0) {
      throw new ValidationError("Unknown ESI scope requested", { scopes: unknownScopes });
    }
    for (const scope of REQUIRED_SCOPES) {
      if (!requestedScopes.includes(scope)) {
        throw new ValidationError("Required ESI scope missing", { scopes: [scope] });
      }
    }

    const service = new AuthService(new EsiClient(), new EsiTokenStore());
    const result = await service.beginFlow(
      requestedScopes,
      parsed.data.returnUrl
    );

    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
