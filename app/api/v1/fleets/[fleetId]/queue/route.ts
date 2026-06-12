import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/guards";
import { QueueService } from "@/services/QueueService";
import { YouTubeClient } from "@/infra/media/YouTubeClient";
import { SoundCloudClient } from "@/infra/media/SoundCloudClient";
import { okList, created, errorResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { QueueType } from "@prisma/client";

const submitSchema = z.object({
  mediaUrl: z.string().url(),
  queue: z.enum(["CRUISE", "BATTLE"]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    const { searchParams } = new URL(req.url);
    const queue = (searchParams.get("queue") ?? "CRUISE") as QueueType;

    if (queue !== "CRUISE" && queue !== "BATTLE") {
      throw new ValidationError("queue must be CRUISE or BATTLE");
    }

    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    const entries = await service.list(fleetId, queue, ctx.characterId);
    return okList(entries);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    await rateLimit(req, ctx.characterId, RATE_LIMITS.queueSubmit);

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    const entry = await service.submit(
      fleetId,
      ctx.characterId,
      parsed.data.mediaUrl,
      parsed.data.queue
    );

    return created(entry);
  } catch (err) {
    return errorResponse(err);
  }
}
