import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { FleetJoinService } from "@/services/FleetJoinService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { ok, errorResponse } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await Promise.resolve(params);
    const { characterId } = await requireAuth(req);

    const esiClient = new EsiClient();
    const esiToken = await new EsiTokenStore().getOrRefresh(characterId, esiClient);

    const service = new FleetJoinService(esiClient);
    const result = await service.join(
      token,
      characterId,
      esiToken?.accessToken ?? null,
      esiToken?.scopes ?? []
    );

    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
