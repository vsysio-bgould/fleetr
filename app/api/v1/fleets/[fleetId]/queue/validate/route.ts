import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/guards";
import { QueueService } from "@/services/QueueService";
import { YouTubeClient } from "@/infra/media/YouTubeClient";
import { SoundCloudClient } from "@/infra/media/SoundCloudClient";
import { ok, errorResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import type { QueueType } from "@prisma/client";

const bodySchema = z.object({
  mediaUrl: z.string().url(),
  queue: z.enum(["CRUISE", "BATTLE"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    await requireSession(req, fleetId);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const service = new QueueService(new YouTubeClient(), new SoundCloudClient());
    const metadata = await service.validate(
      fleetId,
      parsed.data.mediaUrl,
      parsed.data.queue as QueueType
    );

    return ok(metadata);
  } catch (err) {
    return errorResponse(err);
  }
}
