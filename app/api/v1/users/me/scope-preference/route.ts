import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { UserService } from "@/services/UserService";
import { noContent, errorResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  scopes: z.array(z.string()).min(1),
});

export async function PATCH(req: NextRequest) {
  try {
    const { characterId } = await requireAuth(req);
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const service = new UserService();
    await service.updateScopePreference(characterId, parsed.data.scopes);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
