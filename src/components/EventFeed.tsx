"use client";

import { useFleet } from "@/contexts/FleetContext";

const TONE_CLASS = {
  info: "border-[#2d3748] text-[#9aa4b2]",
  success: "border-emerald-700/70 text-emerald-300",
  warning: "border-yellow-700/70 text-yellow-300",
  danger: "border-red-700/70 text-red-300",
};

export function EventFeed() {
  const { state } = useFleet();
  const events = state.events;

  return (
    <section className="h-28 shrink-0 border-t border-fleet-border bg-[#0b0f14]/95 flex flex-col">
      <div className="h-8 px-4 flex items-center justify-between border-b border-fleet-border">
        <h2 className="text-[11px] uppercase tracking-[0.08em] text-[#3fa7ff]">
          Events
        </h2>
        <span className="text-[11px] text-fleet-text-muted">
          {events.length} logged
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {events.length === 0 ? (
          <div className="text-xs text-fleet-text-muted">No fleet events yet</div>
        ) : (
          <ol className="flex flex-col gap-1">
            {events.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 text-xs border-l-2 pl-2 min-w-0 ${TONE_CLASS[item.tone ?? "info"]}`}
              >
                <time className="text-[11px] text-fleet-text-muted shrink-0">
                  {new Date(item.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <span className="font-medium text-fleet-text shrink-0">{item.title}</span>
                {item.detail && (
                  <span className="text-fleet-text-muted truncate">{item.detail}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
