import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { FleetService } from "@/services/FleetService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { ok, errorResponse } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { characterId } = await requireAuth(req);
    const service = new FleetService(new EsiClient());
    const result = await service.regenerateToken(params.fleetId, characterId);
    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
