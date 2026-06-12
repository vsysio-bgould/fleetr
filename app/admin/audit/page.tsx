import db from "@/lib/db";

export default async function AdminAuditPage() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, event: true, actor: true, payload: true, createdAt: true },
  });

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-xl font-bold text-fleet-text">Audit Log</h1>
      <div className="bg-fleet-surface border border-fleet-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fleet-border text-fleet-text-muted">
              <th className="text-left px-4 py-3 font-medium">Time</th>
              <th className="text-left px-4 py-3 font-medium">Event</th>
              <th className="text-left px-4 py-3 font-medium">Actor</th>
              <th className="text-left px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fleet-border">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-fleet-muted/10">
                <td className="px-4 py-3 text-fleet-text-muted text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-fleet-text font-mono text-xs">{log.event}</td>
                <td className="px-4 py-3 text-fleet-text-muted text-xs">{log.actor}</td>
                <td className="px-4 py-3 text-fleet-text-muted text-xs font-mono truncate max-w-xs">
                  {JSON.stringify(log.payload)}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-fleet-text-muted">
                  No audit events yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
