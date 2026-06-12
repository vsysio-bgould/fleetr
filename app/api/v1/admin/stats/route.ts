import { NextRequest } from "next/server";
import { requireOperator } from "@/lib/guards";
import { AdminService } from "@/services/AdminService";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireOperator(req);
    const service = new AdminService();
    const stats = await service.getStats();
    return ok(stats);
  } catch (err) {
    return errorResponse(err);
  }
}
