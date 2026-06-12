import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { FleetShell } from "@/components/FleetShell";

interface Props {
  children: React.ReactNode;
  params: { fleetId: string };
}

export default async function FleetLayout({ children, params }: Props) {
  const cookieStore = cookies();
  const token = cookieStore.get("fleetr_token")?.value;
  if (!token) redirect("/login");

  const apiToken = await db.apiToken.findUnique({
    where: { id: token },
    select: { characterId: true, expiresAt: true },
  });

  if (!apiToken || apiToken.expiresAt < new Date()) {
    redirect("/login");
  }

  const characterId = apiToken.characterId;

  const [session, fleet] = await Promise.all([
    db.session.findUnique({
      where: { fleetId_characterId: { fleetId: params.fleetId, characterId } },
      select: { role: true, expiresAt: true, grantedScopes: true },
    }),
    db.fleet.findUnique({
      where: { id: params.fleetId },
      select: {
        name: true,
        mediaSource: true,
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

  return (
    <FleetShell
      fleetId={params.fleetId}
      characterId={characterId}
      role={session.role}
      grantedScopes={session.grantedScopes as string[]}
      mediaSource={fleet.mediaSource}
      fleetName={fleet.name}
      fcName={fleet.fc.characterName}
      partyKitHost={partyKitHost}
      partyKitToken={token}
    >
      {children}
    </FleetShell>
  );
}
