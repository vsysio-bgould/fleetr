import { NextRequest } from "next/server";
import { requireFleetControl, requireSession } from "@/lib/guards";
import { FleetService } from "@/services/FleetService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { ok, noContent, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    await requireSession(req, fleetId);
    const service = new FleetService(new EsiClient());
    const fleet = await service.getById(fleetId);
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
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFleetControl(ctx);
    const service = new FleetService(new EsiClient());
    await service.disband(fleetId, ctx.characterId, ctx.role);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
