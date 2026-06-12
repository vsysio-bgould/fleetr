import { NextRequest } from "next/server";
import { requireOperator } from "@/lib/guards";
import { AdminService } from "@/services/AdminService";
import { noContent, errorResponse } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { characterId: string } }
) {
  try {
    const { characterId } = await Promise.resolve(params);
    const auth = await requireOperator(req);
    const targetId = parseInt(characterId, 10);
    const service = new AdminService();
    await service.revokeOperator(targetId, auth.characterId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
