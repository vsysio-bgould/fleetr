import { NextRequest } from "next/server";
import { requireSession, requireFc } from "@/lib/guards";
import { DelegateService } from "@/services/DelegateService";
import { ok, created, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    await requireSession(req, params.fleetId);
    const service = new DelegateService();
    const delegates = await service.list(params.fleetId);
    return ok(delegates);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const ctx = await requireSession(req, params.fleetId);
    requireFc(ctx);
    const body = await req.json();
    const targetCharacterId = parseInt(body.characterId, 10);
    const service = new DelegateService();
    await service.grant(params.fleetId, ctx.characterId, targetCharacterId);
    return created({ fleetId: params.fleetId, characterId: targetCharacterId });
  } catch (err) {
    return errorResponse(err);
  }
}
