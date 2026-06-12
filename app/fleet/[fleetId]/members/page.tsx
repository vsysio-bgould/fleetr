"use client";

import { useFleet } from "@/contexts/FleetContext";
import { MemberRoster } from "@/components/MemberRoster";
import { SCOPE_GATES } from "@/config/scope-gates";

export default function MembersPage() {
  const { hasScope } = useFleet();
  const hasLocationScope = hasScope(SCOPE_GATES.LOCATION.scope);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-fleet-border">
        <h2 className="text-base font-semibold text-fleet-text">Members</h2>
      </div>
      {!hasLocationScope && (
        <div className="px-4 py-2 border-b border-fleet-border text-xs text-fleet-text-muted">
          Location scope is not enabled, so solar systems may be blank.
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <MemberRoster />
      </div>
    </div>
  );
}
