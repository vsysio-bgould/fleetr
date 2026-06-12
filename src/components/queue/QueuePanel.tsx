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

  // Sort order per spec: votes desc, position asc for ties
  const byVotesThenPosition = (a: (typeof queue)[number], b: (typeof queue)[number]) =>
    b.votes - a.votes || a.position - b.position;

  const cruiseEntries = queue.filter((e) => e.queue === "CRUISE").sort(byVotesThenPosition);
  const battleEntries = queue.filter((e) => e.queue === "BATTLE").sort(byVotesThenPosition);
  const visibleEntries = activeTab === "CRUISE" ? cruiseEntries : battleEntries;

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
          emptyMessage={`No ${activeTab.toLowerCase()} tracks — add one below`}
        />
      </div>
      <SubmitMediaForm defaultQueue={activeTab} />
    </div>
  );
}
