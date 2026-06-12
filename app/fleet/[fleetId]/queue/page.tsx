"use client";

import { QueuePanel } from "@/components/queue/QueuePanel";

export default function QueuePage() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-fleet-border">
        <h2 className="text-base font-semibold text-fleet-text">Queue</h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <QueuePanel />
      </div>
    </div>
  );
}
