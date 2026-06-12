"use client";

import { useEffect, useRef, useState } from "react";
import { useFleet } from "@/contexts/FleetContext";
import { Tooltip } from "@/components/ui/Tooltip";

const VOLUME_SEND_INTERVAL_MS = 1000;

export function VolumeIndicator() {
  const { state, send, myRole } = useFleet();
  const volume = state.volume;
  const [draftVolume, setDraftVolume] = useState(volume);
  const lastSentAtRef = useRef(0);
  const pendingVolumeRef = useRef<number | null>(null);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";
  const battleMultiplier = state.battleVolumePercent / 100;
  const effectiveVolume = Math.round(
    draftVolume * (state.mode === "BATTLE" ? battleMultiplier : 1)
  );

  useEffect(() => {
    setDraftVolume(volume);
  }, [volume]);

  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    };
  }, []);

  const flushVolume = () => {
    const pending = pendingVolumeRef.current;
    if (pending === null) return;
    pendingVolumeRef.current = null;
    lastSentAtRef.current = Date.now();
    send({ type: "fleet:set-volume", volume: pending });
  };

  const scheduleVolumeSend = (v: number) => {
    if (!isFc) return;
    pendingVolumeRef.current = v;

    const elapsed = Date.now() - lastSentAtRef.current;
    if (elapsed >= VOLUME_SEND_INTERVAL_MS) {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
      flushVolume();
      return;
    }

    if (!sendTimeoutRef.current) {
      sendTimeoutRef.current = setTimeout(() => {
        sendTimeoutRef.current = null;
        flushVolume();
      }, VOLUME_SEND_INTERVAL_MS - elapsed);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fleet-text-muted">
        {state.mode === "BATTLE" ? "Battle Vol" : "Vol"}
      </span>
      <Tooltip content="Set fleet-wide volume" side="top">
        <input
          type="range"
          min={0}
          max={100}
          value={draftVolume}
          disabled={!isFc}
          onChange={(e) => {
            const next = Number(e.target.value);
            setDraftVolume(next);
            scheduleVolumeSend(next);
          }}
          className="w-24 accent-fleet-accent disabled:opacity-50"
        />
      </Tooltip>
      <span className="text-xs text-fleet-text-muted w-14 text-right">
        {effectiveVolume}
        {effectiveVolume !== draftVolume ? `/${draftVolume}` : ""}
      </span>
    </div>
  );
}
