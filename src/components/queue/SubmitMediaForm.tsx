"use client";

import { useState } from "react";
import { useFleet } from "@/contexts/FleetContext";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  defaultQueue?: "CRUISE" | "BATTLE";
}

export function SubmitMediaForm({ defaultQueue = "CRUISE" }: Props) {
  const { fleetId } = useFleet();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/fleets/${fleetId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: url, queue: defaultQueue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message ?? "Failed to submit");
        return;
      }
      setUrl("");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 px-4 py-3 border-t border-[#1f2a36]">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube or SoundCloud URL..."
          className="flex-1 bg-[#0b0f14] border border-[#253140] text-[#e6edf3] text-sm rounded px-3 py-2 placeholder:text-[#4a5568] focus:outline-none focus:border-[#3fa7ff]"
        />
        <Tooltip content={`Add this track to the ${defaultQueue.toLowerCase()} queue`} side="top">
          <button
            type="submit"
            disabled={pending || !url.trim()}
            className="px-3 py-2 bg-[#3fa7ff] hover:bg-[#5ab8ff] disabled:opacity-50 text-[#0b0f14] text-sm font-semibold rounded transition-colors"
          >
            {pending ? "..." : "Add"}
          </button>
        </Tooltip>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}
