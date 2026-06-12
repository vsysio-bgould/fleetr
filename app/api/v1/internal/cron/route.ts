import { NextRequest, NextResponse } from "next/server";
import {
  fleetCleanupQueue,
  sessionCleanupQueue,
  esiTokenRefreshQueue,
  fcPresenceQueue,
} from "@/lib/queue";
import db from "@/lib/db";

function requireSecret(req: NextRequest): boolean {
  return req.headers.get("X-Cron-Secret") === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const job = searchParams.get("job");

  switch (job) {
    case "fleet-cleanup":
      await fleetCleanupQueue.add("cleanup", { olderThanDays: 7 });
      break;

    case "session-cleanup":
      await sessionCleanupQueue.add("cleanup", {});
      break;

    case "esi-token-refresh": {
      // Queue a refresh job for every character with an ESI token expiring within 10 minutes
      const soon = new Date(Date.now() + 10 * 60 * 1000);
      const tokens = await db.esiToken.findMany({
        where: { accessTokenExpiresAt: { lt: soon } },
        select: { characterId: true },
      });
      await Promise.all(
        tokens.map((t) =>
          esiTokenRefreshQueue.add(
            "refresh",
            { characterId: t.characterId },
            { jobId: `esi-refresh:${t.characterId}` }
          )
        )
      );
      return NextResponse.json({ queued: tokens.length });
    }

    case "fc-presence": {
      // Queue a presence check for every active fleet
      const fleets = await db.fleet.findMany({
        where: {
          disbandedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });
      await Promise.all(
        fleets.map((f) =>
          fcPresenceQueue.add(
            "check",
            { fleetId: f.id },
            { jobId: `fc-presence:${f.id}` }
          )
        )
      );
      return NextResponse.json({ queued: fleets.length });
    }

    default:
      return NextResponse.json({ error: "Unknown job" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
