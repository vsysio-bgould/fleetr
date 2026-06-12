"use client";

import type { QueueEntry as QueueEntryType } from "@/contexts/FleetContext";
import { useFleet } from "@/contexts/FleetContext";
import { VoteButton } from "@/components/queue/VoteButton";
import { DownvoteButton } from "@/components/queue/DownvoteButton";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  entry: QueueEntryType;
  position: number;
}

export function QueueEntryRow({ entry, position }: Props) {
  const { fleetId, myRole, state, send } = useFleet();
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";
  const submitter = state.members[entry.submittedBy];
  const isRemoved = Boolean(entry.removedAt);
  const isNowPlaying = state.nowPlaying?.queueEntryId === entry.id;

  const handleRemove = async () => {
    await fetch(`/api/v1/fleets/${fleetId}/queue/${entry.id}`, { method: "DELETE" });
  };

  return (
    <div
      className={`grid grid-cols-[2rem_4rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 group border-l-2 transition-colors ${
        isNowPlaying
          ? "border-[#3fa7ff] bg-[#3fa7ff]/10"
          : "border-transparent hover:bg-fleet-muted/10"
      }`}
    >
      <span className="text-xs text-fleet-text-muted w-5 text-center shrink-0">{position}</span>

      {entry.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.thumbnailUrl}
          alt=""
          className="w-16 h-9 rounded object-cover shrink-0 bg-black"
        />
      ) : (
        <div className="w-16 h-9 rounded bg-black" />
      )}

      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`text-sm font-medium truncate ${isRemoved ? "text-fleet-text-muted" : "text-fleet-text"}`}>
            {entry.title}
          </div>
          {isNowPlaying && (
            <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-[#3fa7ff]">
              Playing
            </span>
          )}
        </div>
        <div className="text-xs text-fleet-text-muted truncate mt-0.5">
          {isRemoved
            ? "Deleted by downvote threshold or FC"
            : `Suggested by ${submitter ? submitter.characterName : `Character ${entry.submittedBy}`}`}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isFc && !isRemoved && (
          <Tooltip content="Play this track for the fleet" side="top">
            <button
              onClick={() => send({ type: "fleet:set-track", queueEntryId: entry.id })}
              className="text-xs px-2 py-1 rounded border border-fleet-border text-fleet-text-muted hover:border-fleet-accent hover:text-fleet-text transition-colors"
            >
              Play
            </button>
          </Tooltip>
        )}
        {!isRemoved && (
          <>
            <VoteButton entryId={entry.id} votes={entry.votes} hasVoted={entry.hasVoted} />
            <DownvoteButton
              entryId={entry.id}
              downvotes={entry.downvotes}
              hasDownvoted={entry.hasDownvoted}
            />
          </>
        )}
        {isFc && !isRemoved && (
          <Tooltip content="Delete this track from the queue" side="top">
            <button
              onClick={handleRemove}
              className="ml-1 text-xs px-1.5 py-1 rounded border border-red-800 text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
            >
              x
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
