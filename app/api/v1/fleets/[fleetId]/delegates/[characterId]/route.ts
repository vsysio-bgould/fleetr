import { NextRequest } from "next/server";
import { requireSession, requireFc } from "@/lib/guards";
import { DelegateService } from "@/services/DelegateService";
import { noContent, errorResponse } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string; characterId: string } }
) {
  try {
    const ctx = await requireSession(req, params.fleetId);
    requireFc(ctx);
    const targetId = parseInt(params.characterId, 10);
    const service = new DelegateService();
    await service.revoke(params.fleetId, targetId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
