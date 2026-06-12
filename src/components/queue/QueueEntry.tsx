"use client";

import type { QueueEntry as QueueEntryType } from "@/contexts/FleetContext";
import { useFleet } from "@/contexts/FleetContext";
import { VoteButton } from "@/components/queue/VoteButton";

interface Props {
  entry: QueueEntryType;
  position: number;
}

export function QueueEntryRow({ entry, position }: Props) {
  const { fleetId, myRole, state } = useFleet();
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";
  const submitter = state.members[entry.submittedBy];

  const handleRemove = async () => {
    await fetch(`/api/v1/fleets/${fleetId}/queue/${entry.id}`, { method: "DELETE" });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-fleet-muted/10 group">
      <span className="text-xs text-fleet-text-muted w-5 text-center shrink-0">{position}</span>

      {entry.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.thumbnailUrl}
          alt=""
          className="w-16 h-9 rounded object-cover shrink-0 bg-black"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-fleet-text truncate">{entry.title}</div>
        <div className="text-xs text-fleet-text-muted truncate mt-0.5">
          {submitter ? submitter.characterName : `Character ${entry.submittedBy}`}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <VoteButton entryId={entry.id} votes={entry.votes} hasVoted={entry.hasVoted} />
        {isFc && (
          <button
            onClick={handleRemove}
            className="ml-1 text-xs px-1.5 py-1 rounded border border-red-800 text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
