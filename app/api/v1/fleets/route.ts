import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { FleetService } from "@/services/FleetService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { created, errorResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import db from "@/lib/db";

const createSchema = z.object({
  mediaSource: z.enum(["YOUTUBE", "SOUNDCLOUD"]).default("YOUTUBE"),
});

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await requireAuth(req);
    await rateLimit(req, characterId, RATE_LIMITS.fcAction);

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    // Get the FC's current access token for the ESI check
    const esiToken = await db.esiToken.findUnique({
      where: { characterId },
      select: { accessToken: true },
    });

    if (!esiToken) {
      throw new ValidationError("No ESI token found — please re-authenticate");
    }

    const service = new FleetService(new EsiClient());
    const fleet = await service.create(
      characterId,
      esiToken.accessToken,
      parsed.data.mediaSource
    );

    return created(fleet);
  } catch (err) {
    return errorResponse(err);
  }
}
