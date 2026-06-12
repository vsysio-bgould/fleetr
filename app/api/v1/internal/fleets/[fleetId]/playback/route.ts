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
    if (!requireSecret(req)) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid secret" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { queueEntryId, initiatedBy } = body;

    const service = new PlaybackService();

    if (queueEntryId === null || queueEntryId === undefined) {
      // Clear playback reference
      await service.advance(params.fleetId, initiatedBy);
    } else {
      await service.setTrack(params.fleetId, queueEntryId, initiatedBy);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
