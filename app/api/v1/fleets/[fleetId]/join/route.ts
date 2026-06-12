import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { FleetJoinService } from "@/services/FleetJoinService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { ok, noContent, errorResponse } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const { characterId } = await requireAuth(req);

    const esiClient = new EsiClient();
    const esiToken = await new EsiTokenStore().getOrRefresh(characterId, esiClient);

    const service = new FleetJoinService(esiClient);

    // We need the join token, not fleetId, to look up the fleet.
    // The POST body can provide it, or the client resolves it from a join URL.
    const body = await req.json().catch(() => ({}));
    const joinToken = body.joinToken ?? fleetId;

    const result = await service.join(
      joinToken,
      characterId,
      esiToken?.accessToken ?? null,
      esiToken?.scopes ?? []
    );

    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const { characterId } = await requireAuth(req);
    const service = new FleetJoinService(new EsiClient());
    await service.leave(fleetId, characterId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
