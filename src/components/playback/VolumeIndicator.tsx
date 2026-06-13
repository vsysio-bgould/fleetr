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
  const [draftFleetVolume, setDraftFleetVolume] = useState(state.volume);
  const [draftLocalVolume, setDraftLocalVolume] = useState(localVolume);
  const battleMultiplier = state.battleVolumePercent / 100;
  const effectiveVolume = Math.round(
    draftLocalVolume *
      (draftFleetVolume / 100) *
      (state.mode === "BATTLE" ? battleMultiplier : 1)
  );

  useEffect(() => {
    setDraftFleetVolume(state.volume);
  }, [state.volume]);

  useEffect(() => {
    setDraftLocalVolume(localVolume);
  }, [localVolume]);

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

  const handleLocalVolumeChange = (volume: number) => {
    setDraftLocalVolume(volume);
    setLocalVolume(volume);
  };

  const handleFleetVolumeChange = (volume: number) => {
    setDraftFleetVolume(volume);
    scheduleVolumeSend(volume);
  };

  const localTooltip =
    "Local Volume: Change your local volume. This does not affect the fleet's volume.";
  const fleetTooltip =
    "Fleet Volume: Change volume for fleet members. This reduces playback to a fraction of each member's local volume; 25% local and 20% fleet becomes 5%.";

  return (
    <div className="flex items-center gap-3">
      <VolumeSlider
        label="Local Vol"
        value={draftLocalVolume}
        tooltip={localTooltip}
        onChange={handleLocalVolumeChange}
      />
      {isFc && (
        <VolumeSlider
          label="Fleet Vol"
          value={draftFleetVolume}
          tooltip={fleetTooltip}
          onChange={handleFleetVolumeChange}
        />
      )}
      <span className="text-xs text-fleet-text-muted w-14 text-right">
        {effectiveVolume}
      </span>
    </div>
  );
}

function VolumeSlider({
  label,
  value,
  tooltip,
  onChange,
}: {
  label: string;
  value: number;
  tooltip: string;
  onChange: (volume: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fleet-text-muted whitespace-nowrap">{label}</span>
      <Tooltip
        content={tooltip}
        side="top"
      >
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(next);
          }}
          className="w-20 accent-fleet-accent disabled:opacity-50"
        />
      </Tooltip>
      <span className="text-xs text-fleet-text-muted w-8 text-right">{value}</span>
    </div>
  );
}
