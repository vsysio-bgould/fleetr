import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { UserService } from "@/services/UserService";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { characterId } = await requireAuth(req);
    const service = new UserService();
    const profile = await service.getMe(characterId);
    return ok(profile);
  } catch (err) {
    return errorResponse(err);
  }
}
