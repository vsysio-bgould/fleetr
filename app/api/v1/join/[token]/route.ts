import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { FleetJoinService } from "@/services/FleetJoinService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { ok, errorResponse } from "@/lib/api-response";
import db from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await Promise.resolve(params);
    const { characterId } = await requireAuth(req);

    const esiToken = await db.esiToken.findUnique({
      where: { characterId },
      select: { accessToken: true, scopes: true },
    });

    const service = new FleetJoinService(new EsiClient());
    const result = await service.join(
      token,
      characterId,
      esiToken?.accessToken ?? null,
      (esiToken?.scopes as string[]) ?? []
    );

    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
