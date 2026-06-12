import { MetricRow } from "@/components/MetricRow";
import { AdminService } from "@/services/AdminService";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  let stats: Awaited<ReturnType<AdminService["getStats"]>> | null = null;
  let error: string | null = null;

  try {
    // Operator access is enforced by app/admin/layout.tsx
    stats = await new AdminService().getStats();
  } catch {
    error = "Could not load stats";
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-bold text-fleet-text">Overview</h1>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 text-sm rounded px-4 py-3">
          {error}
        </div>
      )}

      {stats && (
        <>
          <section className="bg-fleet-surface border border-fleet-border rounded-lg p-4 flex flex-col divide-y divide-fleet-border">
            <MetricRow label="Active Fleets" value={stats.activeFleets} />
            <MetricRow label="Connected Members" value={stats.connectedMembers} />
            <MetricRow label="PartyKit Rooms" value={stats.partyKitRooms} />
            <MetricRow
              label="ESI Error Budget"
              value={stats.esiErrorBudget !== null ? stats.esiErrorBudget : "—"}
            />
            <MetricRow label="Token Refresh Failures (24h)" value={stats.tokenRefreshFailures24h} />
          </section>

          <section className="bg-fleet-surface border border-fleet-border rounded-lg p-4 flex flex-col divide-y divide-fleet-border">
            <MetricRow
              label="Database"
              value={
                <span className={stats.dbStatus === "ok" ? "text-green-400" : "text-red-400"}>
                  {stats.dbStatus.toUpperCase()}
                </span>
              }
            />
            <MetricRow
              label="Redis"
              value={
                <span className={stats.redisStatus === "ok" ? "text-green-400" : "text-red-400"}>
                  {stats.redisStatus.toUpperCase()}
                </span>
              }
            />
          </section>
        </>
      )}
    </div>
  );
}
