import { NextRequest } from "next/server";
import { requireSession, requireFc } from "@/lib/guards";
import { MemberService } from "@/services/MemberService";
import { noContent, errorResponse } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string; characterId: string } }
) {
  try {
    const ctx = await requireSession(req, params.fleetId);
    requireFc(ctx);
    const targetId = parseInt(params.characterId, 10);
    const service = new MemberService();
    await service.kick(params.fleetId, ctx.characterId, targetId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
