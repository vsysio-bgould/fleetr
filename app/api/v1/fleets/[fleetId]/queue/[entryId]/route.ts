import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, requireFc } from "@/lib/guards";
import { QueueService } from "@/services/QueueService";
import { YouTubeClient } from "@/infra/media/YouTubeClient";
import { SoundCloudClient } from "@/infra/media/SoundCloudClient";
import { ok, noContent, errorResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { hasFleetControl } from "@/lib/roles";

const reorderSchema = z.object({
  position: z.number().positive(),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string; entryId: string } }
) {
  try {
    const { fleetId, entryId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    const isFC = hasFleetControl(ctx.role);

    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    await service.remove(fleetId, entryId, ctx.characterId, isFC);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { fleetId: string; entryId: string } }
) {
  try {
    const { fleetId, entryId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFc(ctx);

    const body = await req.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    const updated = await service.reorder(
      fleetId,
      entryId,
      ctx.characterId,
      parsed.data.position
    );
    return ok(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
