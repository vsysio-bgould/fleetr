import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import logger from "@/lib/logger";

function requireSecret(req: NextRequest): boolean {
  const secret = req.headers.get("X-PartyKit-Secret");
  return secret === process.env.PARTYKIT_SECRET;
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

    const message = await req.json();
    const partyKitHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST!;
    const secret = process.env.PARTYKIT_SECRET!;

    const roomId = `fleet-${params.fleetId}`;

    const res = await fetch(`http://${partyKitHost}/parties/main/${roomId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PartyKit-Secret": secret,
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status, fleetId: params.fleetId },
        "PartyKit broadcast failed"
      );
      return NextResponse.json(
        { error: { code: "BROADCAST_FAILED", message: "PartyKit unreachable" } },
        { status: 502 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
