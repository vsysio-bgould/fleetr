import { NextRequest } from "next/server";
import { requireOperator } from "@/lib/guards";
import { AdminService } from "@/services/AdminService";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireOperator(req);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const event = searchParams.get("event") ?? undefined;
    const service = new AdminService();
    const log = await service.getAuditLog({ limit, event });
    return ok(log);
  } catch (err) {
    return errorResponse(err);
  }
}
