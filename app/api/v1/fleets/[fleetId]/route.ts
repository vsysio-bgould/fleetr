import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { requireSession } from "@/lib/guards";
import { FleetService } from "@/services/FleetService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { ok, noContent, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    await requireSession(req, params.fleetId);
    const service = new FleetService(new EsiClient());
    const fleet = await service.getById(params.fleetId);
    return ok(fleet);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { characterId } = await requireAuth(req);
    const service = new FleetService(new EsiClient());
    await service.disband(params.fleetId, characterId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
