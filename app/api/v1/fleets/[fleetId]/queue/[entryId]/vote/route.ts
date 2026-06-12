import { NextRequest } from "next/server";
import { requireSession } from "@/lib/guards";
import { QueueService } from "@/services/QueueService";
import { YouTubeClient } from "@/infra/media/YouTubeClient";
import { SoundCloudClient } from "@/infra/media/SoundCloudClient";
import { ok, noContent, errorResponse } from "@/lib/api-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string; entryId: string } }
) {
  try {
    const ctx = await requireSession(req, params.fleetId);
    await rateLimit(req, ctx.characterId, RATE_LIMITS.vote);
    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    const votes = await service.vote(params.fleetId, params.entryId, ctx.characterId);
    return ok({ votes });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string; entryId: string } }
) {
  try {
    const ctx = await requireSession(req, params.fleetId);
    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    await service.unvote(params.fleetId, params.entryId, ctx.characterId);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
