"use client";

import type { QueueEntry } from "@/contexts/FleetContext";
import { QueueEntryRow } from "./QueueEntry";

interface Props {
  entries: QueueEntry[];
  emptyMessage?: string;
}

export function QueueList({ entries, emptyMessage = "The queue is empty — add a track below" }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-[#9aa4b2] text-sm text-center py-12">{emptyMessage}</div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-[#1f2a36]">
      {entries.map((entry, i) => (
        <QueueEntryRow key={entry.id} entry={entry} position={i + 1} />
      ))}
    </div>
  );
}
