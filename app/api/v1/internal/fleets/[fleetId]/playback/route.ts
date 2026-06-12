import { NextRequest, NextResponse } from "next/server";
import { PlaybackService } from "@/services/PlaybackService";
import { errorResponse } from "@/lib/api-response";

function requireSecret(req: NextRequest): boolean {
  return req.headers.get("X-PartyKit-Secret") === process.env.PARTYKIT_SECRET;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    if (!requireSecret(req)) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid secret" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { queueEntryId, initiatedBy, broadcast } = body;

    const service = new PlaybackService();

    let message;
    if (queueEntryId === null || queueEntryId === undefined) {
      // Clear playback reference
      const result = await service.advance(fleetId, initiatedBy, { broadcast });
      message = result.message;
    } else {
      message = await service.setTrack(fleetId, queueEntryId, initiatedBy, { broadcast });
    }

    return NextResponse.json({ data: { message } });
  } catch (err) {
    return errorResponse(err);
  }
}
