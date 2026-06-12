import { NextRequest } from "next/server";
import { requireOperator } from "@/lib/guards";
import { AdminService } from "@/services/AdminService";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireOperator(req);
    const { searchParams } = new URL(req.url);
    const includeExpired = searchParams.get("includeExpired") === "true";
    const service = new AdminService();
    const fleets = await service.listFleets({ includeExpired });
    return ok(fleets);
  } catch (err) {
    return errorResponse(err);
  }
}
