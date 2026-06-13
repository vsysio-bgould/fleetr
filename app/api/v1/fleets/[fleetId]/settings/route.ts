import { NextRequest } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { ok, errorResponse } from "@/lib/api-response";
import { requireFleetControl, requireSession } from "@/lib/guards";
import { ValidationError } from "@/lib/errors";
import { broadcastToFleet } from "@/lib/broadcast";
import type { ServerMessage } from "@/config/party-messages";

const settingsSchema = z.object({
  battleVolumePercent: z.number().int().min(0).max(100).optional(),
  downvoteDeletePercent: z.number().int().min(1).max(100).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { fleetId: string } }
) {
  try {
    const { fleetId } = await Promise.resolve(params);
    const ctx = await requireSession(req, fleetId);
    requireFleetControl(ctx);

    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const updated = await db.fleet.update({
      where: { id: fleetId },
      data: parsed.data,
      select: { battleVolumePercent: true, downvoteDeletePercent: true },
    });

    const message = {
      type: "fleet:settings-changed",
      battleVolumePercent: updated.battleVolumePercent,
      downvoteDeletePercent: updated.downvoteDeletePercent,
    } satisfies ServerMessage;

    void broadcastToFleet(fleetId, message);

    return ok(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
