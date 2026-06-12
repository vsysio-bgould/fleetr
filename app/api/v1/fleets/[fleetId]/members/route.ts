import { NextRequest } from "next/server";
import { requireSession, requireFc } from "@/lib/guards";
import { MemberService } from "@/services/MemberService";
import { okList, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFc(ctx);
    const service = new MemberService();
    const members = await service.list(fleetId);
    return okList(members);
  } catch (err) {
    return errorResponse(err);
  }
}
