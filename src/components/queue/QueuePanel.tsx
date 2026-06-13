"use client";

import { useState } from "react";
import { useFleet } from "@/contexts/FleetContext";
import { QueueTab } from "./QueueTab";
import { QueueList } from "./QueueList";
import { SubmitMediaForm } from "./SubmitMediaForm";

export function QueuePanel() {
  const { state } = useFleet();
  const { queue } = state;
  const [activeTab, setActiveTab] = useState<"CRUISE" | "BATTLE">("CRUISE");
  const [showDeleted, setShowDeleted] = useState(false);

  const currentEntryId = state.nowPlaying?.queueEntryId ?? null;
  const byScoreThenPosition = (a: (typeof queue)[number], b: (typeof queue)[number]) => {
    if (a.id === currentEntryId && b.id !== currentEntryId) return -1;
    if (b.id === currentEntryId && a.id !== currentEntryId) return 1;
    return (b.votes - (b.downvotes ?? 0)) - (a.votes - (a.downvotes ?? 0)) || a.position - b.position;
  };

  const activeEntries = queue.filter((e) => !e.removedAt);
  const deletedEntries = queue.filter((e) => e.removedAt);
  const cruiseEntries = activeEntries.filter((e) => e.queue === "CRUISE").sort(byScoreThenPosition);
  const battleEntries = activeEntries.filter((e) => e.queue === "BATTLE").sort(byScoreThenPosition);
  const visibleEntries = activeTab === "CRUISE" ? cruiseEntries : battleEntries;
  const visibleDeletedEntries = deletedEntries
    .filter((e) => e.queue === activeTab)
    .sort((a, b) => (b.removedAt ?? "").localeCompare(a.removedAt ?? ""));

  return (
    <div className="flex flex-col h-full">
      <QueueTab
        active={activeTab}
        cruiseCount={cruiseEntries.length}
        battleCount={battleEntries.length}
        onChange={setActiveTab}
      />
      <div className="flex-1 overflow-y-auto">
        <QueueList
          entries={visibleEntries}
          emptyMessage={`No ${activeTab.toLowerCase()} tracks - add one below`}
        />
        <div className="border-t border-fleet-border">
          <button
            type="button"
            onClick={() => setShowDeleted((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-fleet-text-muted hover:text-fleet-text transition-colors"
          >
            <span>Deleted tracks</span>
            <span>
              {visibleDeletedEntries.length} {showDeleted ? "^" : "v"}
            </span>
          </button>
          {showDeleted && (
            <QueueList entries={visibleDeletedEntries} emptyMessage="No deleted tracks" />
          )}
        </div>
      </div>
      <SubmitMediaForm defaultQueue={activeTab} />
    </div>
  );
}
