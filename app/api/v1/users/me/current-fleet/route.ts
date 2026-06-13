import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { ok, errorResponse } from "@/lib/api-response";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";

const FLEET_READ_SCOPE = "esi-fleets.read_fleet.v1";

export async function GET(req: NextRequest) {
  try {
    const { characterId } = await requireAuth(req);
    const esiClient = new EsiClient();
    const token = await new EsiTokenStore().getOrRefresh(characterId, esiClient);

    if (!token || !token.scopes.includes(FLEET_READ_SCOPE)) {
      return ok({ esiFleetId: null, fleetrFleetId: null });
    }

    const membership = await esiClient.getFleetMembership(characterId, token.accessToken);
    if (!membership) {
      return ok({ esiFleetId: null, fleetrFleetId: null });
    }

    const fleetrFleet = await db.fleet.findFirst({
      where: {
        esiFleetId: membership.fleetId,
        disbandedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });

    return ok({
      esiFleetId: membership.fleetId,
      fleetrFleetId: fleetrFleet?.id ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
