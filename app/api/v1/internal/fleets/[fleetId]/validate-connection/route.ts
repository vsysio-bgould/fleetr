import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { errorResponse } from "@/lib/api-response";

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
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid secret" } }, { status: 401 });
    }

    const { token } = await req.json();

    // Validate the bearer token
    const apiToken = await db.apiToken.findUnique({
      where: { id: token },
      select: { characterId: true, expiresAt: true },
    });

    if (!apiToken || apiToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
        { status: 401 }
      );
    }

    // Validate fleet session
    const session = await db.session.findUnique({
      where: {
        fleetId_characterId: {
          fleetId: params.fleetId,
          characterId: apiToken.characterId,
        },
      },
      select: { role: true, expiresAt: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active session for this fleet" } },
        { status: 403 }
      );
    }

    const user = await db.user.findUnique({
      where: { characterId: apiToken.characterId },
      select: { characterName: true },
    });

    return NextResponse.json({
      characterId: apiToken.characterId,
      characterName: user?.characterName ?? "Unknown",
      role: session.role,
      fleetId: params.fleetId,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
