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
    const { fleetId } = await Promise.resolve(params);
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
    const characterId = apiToken.characterId;

    async function findSession() {
      return (
        (await db.session.findUnique({
          where: {
            fleetId_characterId: {
              fleetId,
              characterId,
            },
          },
          select: { role: true, expiresAt: true },
        })) ??
        db.session.findFirst({
          where: {
            fleetId,
            characterId,
            expiresAt: { gt: new Date() },
          },
          select: { role: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        })
      );
    }

    // Validate fleet session
    const [session, fleet] = await Promise.all([
      findSession(),
      db.fleet.findUnique({
        where: { id: fleetId },
        select: {
          battleVolumePercent: true,
          downvoteDeletePercent: true,
          disbandedAt: true,
          expiresAt: true,
        },
      }),
    ]);

    const user = await db.user.findUnique({
      where: { characterId },
      select: { characterName: true, isOperator: true },
    });
    const isOperator = user?.isOperator ?? false;

    if (
      !fleet ||
      fleet.disbandedAt ||
      (fleet.expiresAt && fleet.expiresAt < new Date()) ||
      (!isOperator && (!session || session.expiresAt < new Date()))
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active session for this fleet" } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      characterId,
      characterName: user?.characterName ?? "Unknown",
      role: isOperator ? "FLEET_BOSS" : session?.role,
      fleetId,
      battleVolumePercent: fleet.battleVolumePercent,
      downvoteDeletePercent: fleet.downvoteDeletePercent,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
