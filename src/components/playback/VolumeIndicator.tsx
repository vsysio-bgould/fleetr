"use client";

import { useEffect, useRef, useState } from "react";
import { useFleet } from "@/contexts/FleetContext";
import { Tooltip } from "@/components/ui/Tooltip";
import { hasFleetControl } from "@/lib/roles";

const VOLUME_SEND_INTERVAL_MS = 1000;

export function VolumeIndicator() {
  const { state, send, myRole, localVolume, setLocalVolume } = useFleet();
  const lastSentAtRef = useRef(0);
  const pendingVolumeRef = useRef<number | null>(null);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFc = hasFleetControl(myRole);
  const controlVolume = isFc ? state.volume : localVolume;
  const [draftVolume, setDraftVolume] = useState(controlVolume);
  const draftFleetVolume = isFc ? draftVolume : state.volume;
  const draftLocalVolume = isFc ? localVolume : draftVolume;
  const battleMultiplier = state.battleVolumePercent / 100;
  const effectiveVolume = Math.round(
    draftLocalVolume *
      (draftFleetVolume / 100) *
      (state.mode === "BATTLE" ? battleMultiplier : 1)
  );

  useEffect(() => {
    setDraftVolume(controlVolume);
  }, [controlVolume]);

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
    if (!isFc) {
      setLocalVolume(v);
      return;
    }
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
        {isFc ? "Fleet Vol" : "Local Max"}
      </span>
      <Tooltip
        content={isFc ? "Set fleet-wide volume multiplier" : "Set your local maximum volume"}
        side="top"
      >
        <input
          type="range"
          min={0}
          max={100}
          value={draftVolume}
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
