import { NextRequest } from "next/server";
import { requireSession, requireFc } from "@/lib/guards";
import { MemberService } from "@/services/MemberService";
import { noContent, errorResponse } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string; characterId: string } }
) {
  try {
    const { fleetId, characterId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFc(ctx);
    const targetId = parseInt(characterId, 10);
    const service = new MemberService();
    await service.kick(fleetId, ctx.characterId, targetId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
