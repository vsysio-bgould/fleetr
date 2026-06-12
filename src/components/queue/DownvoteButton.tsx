"use client";

import { useState } from "react";
import { useFleet } from "@/contexts/FleetContext";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  entryId: string;
  downvotes: number;
  hasDownvoted: boolean;
}

export function DownvoteButton({ entryId, downvotes, hasDownvoted }: Props) {
  const { fleetId } = useFleet();
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      await fetch(`/api/v1/fleets/${fleetId}/queue/${entryId}/downvote`, {
        method: hasDownvoted ? "DELETE" : "POST",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Tooltip content={hasDownvoted ? "Retract downvote" : "Downvote this track"} side="top">
      <button
        onClick={handleToggle}
        disabled={pending}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
          hasDownvoted
            ? "border-red-600 bg-red-900/20 text-red-400"
            : "border-fleet-border text-fleet-text-muted hover:border-red-700 hover:text-red-400"
        }`}
      >
        <span>v</span>
        <span>{downvotes}</span>
      </button>
    </Tooltip>
  );
}
