import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { AuthService } from "@/services/AuthService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { errorResponse, noContent } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { apiTokenId } = await requireAuth(req);
    const service = new AuthService(new EsiClient(), new EsiTokenStore());
    await service.logout(apiTokenId);

    const response = noContent();
    response.cookies.delete("fleetr_token");
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
