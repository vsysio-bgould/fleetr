import { NextRequest } from "next/server";
import { requireSession } from "@/lib/guards";
import { PlaybackService } from "@/services/PlaybackService";
import { ok, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    await requireSession(req, fleetId);
    const service = new PlaybackService();
    const state = await service.getState(fleetId);
    return ok(state);
  } catch (err) {
    return errorResponse(err);
  }
}
