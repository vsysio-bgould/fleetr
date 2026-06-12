import { NextRequest } from "next/server";
import { requireOperator } from "@/lib/guards";
import { AdminService } from "@/services/AdminService";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    await requireOperator(req);
    const service = new AdminService();
    const fleet = await service.getFleet(fleetId);
    return ok(fleet);
  } catch (err) {
    return errorResponse(err);
  }
}
