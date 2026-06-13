import { NextRequest } from "next/server";
import { requireDelegationManager, requireSession } from "@/lib/guards";
import { DelegateService } from "@/services/DelegateService";
import { noContent, errorResponse } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string; characterId: string } }
) {
  try {
    const { fleetId, characterId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireDelegationManager(ctx);
    const targetId = parseInt(characterId, 10);
    const service = new DelegateService();
    await service.revoke(fleetId, targetId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
