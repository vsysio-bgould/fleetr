import db from "@/lib/db";

export default async function AdminFleetsPage() {
  const fleets = await db.fleet.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      mode: true,
      disbandedAt: true,
      createdAt: true,
      fcCharacterId: true,
      _count: { select: { sessions: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-xl font-bold text-fleet-text">Fleets</h1>
      <div className="bg-fleet-surface border border-fleet-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fleet-border text-fleet-text-muted">
              <th className="text-left px-4 py-3 font-medium">Fleet</th>
              <th className="text-left px-4 py-3 font-medium">Mode</th>
              <th className="text-left px-4 py-3 font-medium">Members</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fleet-border">
            {fleets.map((fleet) => (
              <tr key={fleet.id} className="hover:bg-fleet-muted/10">
                <td className="px-4 py-3 text-fleet-text font-medium">{fleet.name}</td>
                <td className="px-4 py-3 text-fleet-text-muted">{fleet.mode}</td>
                <td className="px-4 py-3 text-fleet-text-muted">{fleet._count.sessions}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      fleet.disbandedAt
                        ? "bg-fleet-muted text-fleet-text-muted"
                        : "bg-green-900/30 text-green-400"
                    }`}
                  >
                    {fleet.disbandedAt ? "Disbanded" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-3 text-fleet-text-muted text-xs">
                  {new Date(fleet.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {!fleet.disbandedAt && (
                    <form action={`/api/v1/admin/fleets/${fleet.id}/disband`} method="POST">
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        Disband
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {fleets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-fleet-text-muted">
                  No fleets yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
