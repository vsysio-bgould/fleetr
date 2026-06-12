"use client";

import { useFleet } from "@/contexts/FleetContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FleetSettingsPage() {
  const { fleetId, myRole } = useFleet();
  const router = useRouter();
  const [disbanding, setDisbanding] = useState(false);

  const isFc = myRole === "FLEET_COMMANDER";

  if (!isFc) {
    return (
      <div className="p-6 text-fleet-text-muted text-sm">
        Only the Fleet Commander can access settings.
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-fleet-border">
        <h2 className="text-base font-semibold text-fleet-text">Fleet Settings</h2>
      </div>
      <div className="p-6 flex flex-col gap-6 max-w-lg">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fleet-text">Join Link</h3>
          <p className="text-sm text-fleet-text-muted">
            Regenerate the join link if it has been compromised.
          </p>
          <button
            onClick={handleRegenerateToken}
            className="w-fit px-3 py-2 text-sm rounded border border-fleet-border text-fleet-text hover:border-fleet-accent transition-colors"
          >
            Regenerate Link
          </button>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
          <p className="text-sm text-fleet-text-muted">
            Disbanding the fleet will end the session for all members.
          </p>
          <button
            onClick={handleDisband}
            disabled={disbanding}
            className="w-fit px-3 py-2 text-sm rounded border border-red-700 text-red-400 hover:bg-red-900/20 disabled:opacity-50 transition-colors"
          >
            {disbanding ? "Disbanding…" : "Disband Fleet"}
          </button>
        </section>
      </div>
    </div>
  );
}
