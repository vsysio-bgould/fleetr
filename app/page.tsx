import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { InstructionsButton } from "@/components/InstructionsButton";
import { LogoutButton } from "@/components/LogoutButton";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ disbanded?: string }>;
}) {
  const { disbanded } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("fleetr_token")?.value;

  if (token) {
    const apiToken = await db.apiToken.findUnique({
      where: { id: token },
      select: { characterId: true, expiresAt: true },
    });

    if (apiToken && apiToken.expiresAt >= new Date()) {
      const session = await db.session.findFirst({
        where: {
          characterId: apiToken.characterId,
          expiresAt: { gt: new Date() },
          fleet: { disbandedAt: null },
        },
        select: { fleetId: true },
        orderBy: { createdAt: "desc" },
      });

      if (session) {
        redirect(`/fleet/${session.fleetId}`);
      }
    }
  }

  return (
    <div className="min-h-screen bg-fleet-bg flex items-center justify-center p-4">
      <div className="bg-fleet-surface border border-fleet-border rounded-lg p-8 w-full max-w-sm flex flex-col gap-6 text-center">
        {disbanded && (
          <div className="rounded border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
            Your fleet has ended - the FC left the EVE fleet. Create a new one below.
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-fleet-text">FLEETR</h1>
          <p className="text-fleet-text-muted text-sm mt-2">
            Real-time fleet music for EVE Online
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/fleet/create"
            className="w-full bg-fleet-accent hover:opacity-90 text-white font-semibold py-3 rounded-md transition-opacity text-sm block"
          >
            Create Fleet
          </Link>
          <p className="text-xs text-fleet-text-muted">
            Or ask your FC for a join link
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <InstructionsButton />
          {token ? (
            <LogoutButton className="text-xs text-fleet-text-muted hover:text-fleet-text transition-colors" />
          ) : (
            <Link
              href="/login"
              className="text-xs text-fleet-text-muted hover:text-fleet-text transition-colors"
            >
              Sign in with EVE Online
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
