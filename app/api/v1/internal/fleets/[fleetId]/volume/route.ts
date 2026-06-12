import { NextRequest, NextResponse } from "next/server";
import { PlaybackService } from "@/services/PlaybackService";
import { errorResponse } from "@/lib/api-response";
import { z } from "zod";

function requireSecret(req: NextRequest): boolean {
  return req.headers.get("X-PartyKit-Secret") === process.env.PARTYKIT_SECRET;
}

const bodySchema = z.object({
  volume: z.number().min(0).max(100),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    if (!requireSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = bodySchema.parse(await req.json());
    const service = new PlaybackService();
    await service.setVolume(params.fleetId, body.volume);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
