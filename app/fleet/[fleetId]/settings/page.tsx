"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFleet } from "@/contexts/FleetContext";
import { Tooltip } from "@/components/ui/Tooltip";
import { hasFleetControl } from "@/lib/roles";

export default function FleetSettingsPage() {
  const { fleetId, myRole, state } = useFleet();
  const router = useRouter();
  const [disbanding, setDisbanding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [battleVolumePercent, setBattleVolumePercent] = useState(state.battleVolumePercent);
  const [downvoteDeletePercent, setDownvoteDeletePercent] = useState(state.downvoteDeletePercent);

  const isFc = hasFleetControl(myRole);

  useEffect(() => {
    setBattleVolumePercent(state.battleVolumePercent);
    setDownvoteDeletePercent(state.downvoteDeletePercent);
  }, [state.battleVolumePercent, state.downvoteDeletePercent]);

  if (!isFc) {
    return (
      <div className="p-6 text-fleet-text-muted text-sm">
        Fleet control access is required for settings.
      </div>
    );
  }

  const handleDisband = async () => {
    if (!confirm("Disband this fleet? This cannot be undone.")) return;
    setDisbanding(true);
    try {
      await fetch(`/api/v1/fleets/${fleetId}`, { method: "DELETE" });
      router.push("/");
    } finally {
      setDisbanding(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm("Regenerate the join link? The old link will stop working.")) return;
    await fetch(`/api/v1/fleets/${fleetId}/token`, { method: "POST" });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/fleets/${fleetId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleVolumePercent, downvoteDeletePercent }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-fleet-border">
        <h2 className="text-base font-semibold text-fleet-text">Fleet Settings</h2>
      </div>
      <div className="p-6 flex flex-col gap-6 max-w-lg">
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-fleet-text">Playback</h3>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-fleet-text-muted">
              Reduce volume to {battleVolumePercent}% in Battle Mode
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={battleVolumePercent}
              onChange={(e) => setBattleVolumePercent(Number(e.target.value))}
              className="accent-fleet-accent"
            />
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-fleet-text">Queue</h3>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-fleet-text-muted">
              Downvote deletion at {downvoteDeletePercent}% of viewers
            </span>
            <input
              type="range"
              min={1}
              max={100}
              value={downvoteDeletePercent}
              onChange={(e) => setDownvoteDeletePercent(Number(e.target.value))}
              className="accent-fleet-accent"
            />
          </label>
          <Tooltip content="Save playback and queue settings" side="top">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-fit px-3 py-2 text-sm rounded border border-fleet-border text-fleet-text hover:border-fleet-accent disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </Tooltip>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fleet-text">Join Link</h3>
          <p className="text-sm text-fleet-text-muted">
            Regenerate the join link if it has been compromised.
          </p>
          <Tooltip content="Create a new join link and invalidate the old one" side="top">
            <button
              onClick={handleRegenerateToken}
              className="w-fit px-3 py-2 text-sm rounded border border-fleet-border text-fleet-text hover:border-fleet-accent transition-colors"
            >
              Regenerate Link
            </button>
          </Tooltip>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
          <p className="text-sm text-fleet-text-muted">
            Disbanding the fleet will end the session for all members.
          </p>
          <Tooltip content="Disband this Fleetr session" side="top">
            <button
              onClick={handleDisband}
              disabled={disbanding}
              className="w-fit px-3 py-2 text-sm rounded border border-red-700 text-red-400 hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            >
              {disbanding ? "Disbanding..." : "Disband Fleet"}
            </button>
          </Tooltip>
        </section>
      </div>
    </div>
  );
}
