import { NextRequest } from "next/server";
import { errorResponse, ok } from "@/lib/api-response";
import { requireFleetCommander, requireSession } from "@/lib/guards";
import { EsiClient } from "@/infra/esi/EsiClient";
import { FleetConfigurationService } from "@/services/FleetConfigurationService";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFleetCommander(ctx);
    const service = new FleetConfigurationService(new EsiClient());
    return ok(await service.get(fleetId));
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
    requireFleetCommander(ctx);
    const service = new FleetConfigurationService(new EsiClient());
    return ok(await service.appendFleetrLink(fleetId));
  } catch (err) {
    return errorResponse(err);
  }
}
