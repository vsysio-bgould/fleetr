import { NextRequest } from "next/server";
import { requireSession } from "@/lib/guards";
import { MemberService } from "@/services/MemberService";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    await requireSession(req, params.fleetId);
    const service = new MemberService();
    const members = await service.list(params.fleetId);
    return ok(members);
  } catch (err) {
    return errorResponse(err);
  }
}
