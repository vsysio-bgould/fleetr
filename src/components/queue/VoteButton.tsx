"use client";

import { useState } from "react";
import { useFleet } from "@/contexts/FleetContext";

interface Props {
  entryId: string;
  votes: number;
  hasVoted: boolean;
}

/** Upvote toggle — POST to vote, DELETE to retract (one vote per character). */
export function VoteButton({ entryId, votes, hasVoted }: Props) {
  const { fleetId } = useFleet();
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      await fetch(`/api/v1/fleets/${fleetId}/queue/${entryId}/vote`, {
        method: hasVoted ? "DELETE" : "POST",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      title={hasVoted ? "Retract vote" : "Vote for this track"}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
        hasVoted
          ? "border-green-600 bg-green-900/20 text-green-400"
          : "border-fleet-border text-fleet-text-muted hover:border-fleet-accent hover:text-fleet-text"
      }`}
    >
      <span>▲</span>
      <span>{votes}</span>
    </button>
  );
}
