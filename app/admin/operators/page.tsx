import db from "@/lib/db";

export default async function AdminOperatorsPage() {
  const operators = await db.user.findMany({
    where: { isOperator: true },
    orderBy: { characterId: "asc" },
    select: { characterId: true, createdAt: true },
  });

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-fleet-text">Operators</h1>
        <p className="text-xs text-fleet-text-muted">
          Operator status is set via DB or the admin API.
        </p>
      </div>

      <div className="bg-fleet-surface border border-fleet-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fleet-border text-fleet-text-muted">
              <th className="text-left px-4 py-3 font-medium">Character ID</th>
              <th className="text-left px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fleet-border">
            {operators.map((op) => (
              <tr key={op.characterId} className="hover:bg-fleet-muted/10">
                <td className="px-4 py-3 text-fleet-text font-mono">{op.characterId}</td>
                <td className="px-4 py-3 text-fleet-text-muted text-xs">
                  {new Date(op.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <form
                    action={`/api/v1/admin/operators/${op.characterId}`}
                    method="POST"
                  >
                    <input type="hidden" name="_method" value="DELETE" />
                    <button
                      type="submit"
                      className="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                      Revoke
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {operators.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-fleet-text-muted">
                  No operators configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
