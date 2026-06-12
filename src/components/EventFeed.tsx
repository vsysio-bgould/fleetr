"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useFleet } from "@/contexts/FleetContext";

const TONE_CLASS = {
  info: "border-[#2d3748] text-[#9aa4b2]",
  success: "border-emerald-700/70 text-emerald-300",
  warning: "border-yellow-700/70 text-yellow-300",
  danger: "border-red-700/70 text-red-300",
};

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 320;
const DEFAULT_HEIGHT = 112;
const STORAGE_KEY = "fleetr:event-feed-height";

export function EventFeed() {
  const { state } = useFleet();
  const events = state.events;
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const nextHeight = Number(saved);
    if (Number.isFinite(nextHeight)) {
      setHeight(clampHeight(nextHeight));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(height));
  }, [height]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startY - event.clientY;
      setHeight(clampHeight(drag.startHeight + delta));
    }

    function handlePointerUp() {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { startY: event.clientY, startHeight: height };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  return (
    <section
      className="shrink-0 border-t border-fleet-border bg-[#0b0f14]/95 flex flex-col"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize events pane"
        onPointerDown={startResize}
        className="h-2 -mt-1 cursor-ns-resize shrink-0 flex items-center justify-center group"
      >
        <span className="h-px w-16 rounded bg-fleet-border group-hover:bg-[#3fa7ff] transition-colors" />
      </div>
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

function clampHeight(height: number): number {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
}
