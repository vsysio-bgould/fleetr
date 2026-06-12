import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { FleetShell } from "@/components/FleetShell";

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
      character: { select: { esiToken: { select: { scopes: true } } } },
    },
  });

  if (!apiToken || apiToken.expiresAt < new Date()) {
    redirect("/login");
  }

  const characterId = apiToken.characterId;

  const [session, fleet] = await Promise.all([
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
  ]);

  if (!session || session.expiresAt < new Date()) {
    redirect("/login");
  }

  if (!fleet) {
    redirect("/");
  }

  const partyKitHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
  const grantedScopes = Array.from(
    new Set([
      ...((session.grantedScopes as string[]) ?? []),
      ...(((apiToken.character.esiToken?.scopes as string[] | undefined) ?? [])),
    ])
  );

  return (
    <FleetShell
      fleetId={fleetId}
      characterId={characterId}
      role={session.role}
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
