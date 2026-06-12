import { NextRequest } from "next/server";
import { requireOperator } from "@/lib/guards";
import { AdminService } from "@/services/AdminService";
import { noContent, errorResponse } from "@/lib/api-response";

// Plan uses DELETE /admin/fleets/:id — alias both verbs
export const DELETE = async (
  req: NextRequest,
  ctx: { params: { fleetId: string } }
) => POST(req, ctx);

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const auth = await requireOperator(req);
    const service = new AdminService();
    await service.forceDisband(fleetId, auth.characterId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
