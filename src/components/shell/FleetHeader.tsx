"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFleet } from "@/contexts/FleetContext";
import { ConnectionPill } from "@/components/ConnectionPill";
import { InstructionsDialog } from "@/components/InstructionsButton";
import { LogoutButton } from "@/components/LogoutButton";

interface Props {
  fleetId: string;
  fleetName: string;
  fcName: string;
  isOperator: boolean;
  activeFleets: Array<{ id: string; name: string; bossName: string }>;
}

export function FleetHeader({
  fleetId,
  fleetName,
  fcName,
  isOperator,
  activeFleets,
}: Props) {
  const { state, connection } = useFleet();
  const { nowPlaying, members } = state;
  const memberCount = Object.keys(members).length;
  const [helpOpen, setHelpOpen] = useState(false);
  const [currentEveFleetId, setCurrentEveFleetId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOperator) return;
    let cancelled = false;

    async function refreshCurrentFleet() {
      try {
        const res = await fetch("/api/v1/users/me/current-fleet", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setCurrentEveFleetId(body.data?.fleetrFleetId ?? null);
      } catch {
        if (!cancelled) setCurrentEveFleetId(null);
      }
    }

    void refreshCurrentFleet();
    const timer = window.setInterval(refreshCurrentFleet, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOperator]);

  function handleFleetChange(nextFleetId: string) {
    if (nextFleetId && nextFleetId !== fleetId) {
      router.push(`/fleet/${nextFleetId}`);
    }
  }

  return (
    <header className="flex items-center h-12 px-4 bg-[#0b0f14] border-b border-[#1f2a36] shrink-0 gap-4">
      {/* Left: fleet identity */}
      <div className="flex flex-col justify-center min-w-0 w-56 shrink-0">
        {isOperator && activeFleets.length > 0 ? (
          <select
            value={fleetId}
            onChange={(event) => handleFleetChange(event.target.value)}
            aria-label="Switch active Fleetr fleet"
            className={`h-7 w-full rounded border bg-[#0f151d] px-2 text-sm font-semibold text-[#e6edf3] outline-none transition-colors hover:border-[#3fa7ff] focus:border-[#3fa7ff] ${
              currentEveFleetId === fleetId ? "border-[#34d399]" : "border-[#1f2a36]"
            }`}
          >
            {activeFleets.map((fleet) => (
              <option key={fleet.id} value={fleet.id}>
                {fleet.id === currentEveFleetId
                  ? `* ${fleet.name} (current EVE fleet)`
                  : fleet.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-semibold text-[#e6edf3] truncate">{fleetName}</span>
        )}
        <span className="text-[11px] text-[#9aa4b2] truncate">
          Boss: {fcName}
          {isOperator
            ? currentEveFleetId === fleetId
              ? " | Operator | Current EVE fleet"
              : " | Operator"
            : ""}
        </span>
      </div>

      {/* Center: now playing */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-4">
        {nowPlaying ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[#3fa7ff] shrink-0">NOW PLAYING</span>
            <span className="text-sm text-[#e6edf3] truncate">{nowPlaying.title}</span>
          </div>
        ) : (
          <span className="text-[11px] text-[#4a5568]">No media playing</span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-[11px] text-[#9aa4b2]">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </div>
        <ConnectionPill status={connection} />
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="text-[11px] text-[#9aa4b2] hover:text-[#e6edf3] border border-[#1f2a36] hover:border-[#3fa7ff] rounded px-2 py-1 transition-colors"
        >
          Help
        </button>
        <LogoutButton />
      </div>
      {helpOpen && <InstructionsDialog onClose={() => setHelpOpen(false)} />}
    </header>
  );
}
