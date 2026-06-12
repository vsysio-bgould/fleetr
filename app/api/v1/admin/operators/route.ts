import { NextRequest } from "next/server";
import { requireOperator } from "@/lib/guards";
import { AdminService } from "@/services/AdminService";
import { noContent, errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    const { characterId, action } = await req.json() as {
      characterId: number;
      action: "grant" | "revoke";
    };
    const service = new AdminService();
    if (action === "grant") {
      await service.grantOperator(characterId, auth.characterId);
    } else {
      await service.revokeOperator(characterId, auth.characterId);
    }
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
