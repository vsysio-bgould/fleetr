import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { FleetShell } from "@/components/FleetShell";
import type { SessionRole } from "@prisma/client";

interface Props {
  children: React.ReactNode;
  params: Promise<{ fleetId: string }>;
}

export default async function FleetLayout({ children, params }: Props) {
  const { fleetId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("fleetr_token")?.value;
  if (!token) redirect("/login");

  const apiToken = await db.apiToken.findUnique({
    where: { id: token },
    select: {
      characterId: true,
      expiresAt: true,
      character: {
        select: {
          isOperator: true,
          esiToken: { select: { scopes: true } },
        },
      },
    },
  });

  if (!apiToken || apiToken.expiresAt < new Date()) {
    redirect("/login");
  }

  const characterId = apiToken.characterId;
  const isOperator = apiToken.character.isOperator;

  const [session, fleet, activeFleets] = await Promise.all([
    db.session.findUnique({
      where: { fleetId_characterId: { fleetId, characterId } },
      select: { role: true, expiresAt: true, grantedScopes: true },
    }),
    db.fleet.findUnique({
      where: { id: fleetId },
      select: {
        name: true,
        mediaSource: true,
        battleVolumePercent: true,
        downvoteDeletePercent: true,
        fc: { select: { characterName: true } },
      },
    }),
    isOperator
      ? db.fleet.findMany({
          where: {
            disbandedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: {
            id: true,
            name: true,
            fc: { select: { characterName: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  if ((!session || session.expiresAt < new Date()) && !isOperator) {
    redirect("/login");
  }

  if (!fleet) {
    redirect("/");
  }

  const partyKitHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
  const grantedScopes = Array.from(
    new Set([
      ...(((session?.grantedScopes as string[] | undefined) ?? [])),
      ...(((apiToken.character.esiToken?.scopes as string[] | undefined) ?? [])),
    ])
  );
  const effectiveRole: SessionRole = isOperator
    ? "FLEET_BOSS"
    : session?.role ?? "LINE_MEMBER";

  return (
    <FleetShell
      fleetId={fleetId}
      characterId={characterId}
      role={effectiveRole}
      isOperator={isOperator}
      activeFleets={activeFleets.map((activeFleet) => ({
        id: activeFleet.id,
        name: activeFleet.name,
        bossName: activeFleet.fc.characterName,
      }))}
      grantedScopes={grantedScopes}
      mediaSource={fleet.mediaSource}
      battleVolumePercent={fleet.battleVolumePercent}
      downvoteDeletePercent={fleet.downvoteDeletePercent}
      fleetName={fleet.name}
      fcName={fleet.fc.characterName}
      partyKitHost={partyKitHost}
      partyKitToken={token}
    >
      {children}
    </FleetShell>
  );
}
