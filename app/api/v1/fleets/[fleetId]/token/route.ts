import { NextRequest } from "next/server";
import { requireFleetControl, requireSession } from "@/lib/guards";
import { FleetService } from "@/services/FleetService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFleetControl(ctx);
    const service = new FleetService(new EsiClient());
    const result = await service.getJoinLink(fleetId);
    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFleetControl(ctx);
    const service = new FleetService(new EsiClient());
    const result = await service.regenerateToken(fleetId, ctx.characterId, ctx.role);
    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
