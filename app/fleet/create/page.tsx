"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MediaSource = "YOUTUBE" | "SOUNDCLOUD";

export default function FleetCreatePage() {
  const router = useRouter();
  const [mediaSource, setMediaSource] = useState<MediaSource>("YOUTUBE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/fleets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaSource }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to create fleet");
        return;
      }
      const { fleetId, joinUrl } = body.data;
      router.push(`/fleet/${fleetId}/created?joinUrl=${encodeURIComponent(joinUrl)}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fleet-bg flex items-center justify-center p-4">
      <div className="bg-fleet-surface border border-fleet-border rounded-lg p-8 w-full max-w-md flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-fleet-text">Create Fleet</h1>
          <p className="text-fleet-text-muted text-sm mt-1">
            You must be the Fleet Boss or Fleet Commander in EVE to continue.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-fleet-text">Media Source</label>
          <div className="flex gap-2">
            {(["YOUTUBE", "SOUNDCLOUD"] as const).map((src) => (
              <button
                key={src}
                onClick={() => setMediaSource(src)}
                className={`flex-1 py-2 px-3 text-sm rounded border transition-colors ${
                  mediaSource === src
                    ? "border-fleet-accent bg-fleet-accent/10 text-fleet-accent"
                    : "border-fleet-border text-fleet-text hover:border-fleet-accent"
                }`}
              >
                {src === "YOUTUBE" ? "YouTube" : "SoundCloud"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-fleet-accent hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-md transition-opacity"
        >
          {loading ? "Creating…" : "Create Fleet"}
        </button>
      </div>
    </div>
  );
}
