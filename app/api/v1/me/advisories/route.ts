import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { AdvisoryService, type AdvisoryKey } from "@/services/AdvisoryService";
import { ok, noContent, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const service = new AdvisoryService();
    const advisories = await service.list(auth.characterId);
    return ok(advisories);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await req.json();
    const { key, permanent = false } = body as { key: AdvisoryKey; permanent?: boolean };
    const service = new AdvisoryService();
    await service.dismiss(auth.characterId, key, permanent);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
