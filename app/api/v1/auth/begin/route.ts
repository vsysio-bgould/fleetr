import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, errorResponse } from "@/lib/api-response";
import { AuthService } from "@/services/AuthService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { ValidationError } from "@/lib/errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const bodySchema = z.object({
  scopes: z.array(z.string()).min(1),
  returnUrl: z.string().optional().default("/"),
});

export async function POST(req: NextRequest) {
  try {
    await rateLimit(req, null, RATE_LIMITS.auth);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const service = new AuthService(new EsiClient(), new EsiTokenStore());
    const result = await service.beginFlow(
      parsed.data.scopes,
      parsed.data.returnUrl
    );

    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
