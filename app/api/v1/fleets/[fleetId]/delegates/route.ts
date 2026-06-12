import { NextRequest } from "next/server";
import { requireSession, requireFc } from "@/lib/guards";
import { DelegateService } from "@/services/DelegateService";
import { ok, created, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    await requireSession(req, fleetId);
    const service = new DelegateService();
    const delegates = await service.list(fleetId);
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
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFc(ctx);
    const body = await req.json();
    const targetCharacterId = parseInt(body.characterId, 10);
    const service = new DelegateService();
    await service.grant(fleetId, ctx.characterId, targetCharacterId);
    return created({ fleetId, characterId: targetCharacterId });
  } catch (err) {
    return errorResponse(err);
  }
}
