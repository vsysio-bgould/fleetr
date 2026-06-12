"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface FleetData {
  id: string;
  name: string;
  joinToken: string;
}

export default function FleetCreatedPage() {
  const params = useParams<{ fleetId: string }>();
  const router = useRouter();
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/fleets/${params.fleetId}`)
      .then((r) => r.json())
      .then(setFleet)
      .catch(console.error);
  }, [params.fleetId]);

  const joinUrl = fleet
    ? `${window.location.origin}/join/${fleet.joinToken}`
    : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openFleet = () => {
    router.push(`/fleet/${params.fleetId}`);
  };

  if (!fleet) {
    return (
      <div className="min-h-screen bg-fleet-bg flex items-center justify-center">
        <div className="text-fleet-text-muted text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fleet-bg flex items-center justify-center p-4">
      <div className="bg-fleet-surface border border-fleet-border rounded-lg p-8 w-full max-w-md flex flex-col gap-6">
        <div>
          <div className="text-green-400 text-4xl mb-2">✓</div>
          <h1 className="text-xl font-bold text-fleet-text">Fleet Created</h1>
          <p className="text-fleet-text-muted text-sm mt-1">
            Share the link below with your fleet members.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-fleet-text-muted uppercase tracking-wide">
            Join Link
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={joinUrl}
              className="flex-1 bg-fleet-bg border border-fleet-border text-fleet-text text-sm rounded px-3 py-2 font-mono"
            />
            <button
              onClick={copyLink}
              className="px-3 py-2 text-sm rounded border border-fleet-border text-fleet-text hover:border-fleet-accent transition-colors whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <button
          onClick={openFleet}
          className="w-full bg-fleet-accent hover:opacity-90 text-white font-semibold py-3 rounded-md transition-opacity"
        >
          Open Fleet Dashboard
        </button>
      </div>
    </div>
  );
}
