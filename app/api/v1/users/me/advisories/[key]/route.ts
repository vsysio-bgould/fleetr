import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { AdvisoryService, type AdvisoryKey } from "@/services/AdvisoryService";
import { noContent, errorResponse } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const auth = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const permanent = Boolean(body.permanent);
    const service = new AdvisoryService();
    await service.dismiss(auth.characterId, params.key as AdvisoryKey, permanent);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
