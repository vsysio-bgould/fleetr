import { NextRequest } from "next/server";
import { requireSession } from "@/lib/guards";
import { QueueService } from "@/services/QueueService";
import { YouTubeClient } from "@/infra/media/YouTubeClient";
import { SoundCloudClient } from "@/infra/media/SoundCloudClient";
import { ok, created, errorResponse } from "@/lib/api-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import logger from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string; entryId: string } }
) {
  try {
    const { fleetId, entryId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    await rateLimit(req, ctx.characterId, RATE_LIMITS.vote);
    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    const result = await service.downvote(fleetId, entryId, ctx.characterId);
    return created(result);
  } catch (err) {
    const { fleetId, entryId } = await Promise.resolve(params).catch(() => ({ fleetId: "?", entryId: "?" }));
    logger.warn({ err, fleetId, entryId, route: "POST downvote" }, "downvote route error");
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fleetId: string; entryId: string } }
) {
  try {
    const { fleetId, entryId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    const downvotes = await service.removeDownvote(fleetId, entryId, ctx.characterId);
    return ok({ downvotes });
  } catch (err) {
    const { fleetId, entryId } = await Promise.resolve(params).catch(() => ({ fleetId: "?", entryId: "?" }));
    logger.warn({ err, fleetId, entryId, route: "DELETE downvote" }, "downvote route error");
    return errorResponse(err);
  }
}
