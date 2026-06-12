import { NextRequest, NextResponse } from "next/server";
import { PlaybackService } from "@/services/PlaybackService";
import { errorResponse } from "@/lib/api-response";
import { z } from "zod";

function requireSecret(req: NextRequest): boolean {
  return req.headers.get("X-PartyKit-Secret") === process.env.PARTYKIT_SECRET;
}

const bodySchema = z.object({
  mode: z.enum(["CRUISE", "BATTLE"]),
  initiatedBy: z.number().nullable().default(null),
  broadcast: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    if (!requireSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = bodySchema.parse(await req.json());
    const service = new PlaybackService();
    const message = await service.setMode(fleetId, body.mode, body.initiatedBy, {
      broadcast: body.broadcast,
    });
    return NextResponse.json({ data: { message } });
  } catch (err) {
    return errorResponse(err);
  }
}
