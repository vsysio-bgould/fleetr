"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface JoinResult {
  fleetId: string;
  role: string;
}

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"joining" | "error">("joining");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const join = async () => {
      try {
        // Resolve fleet by join token first
        const resolveRes = await fetch(`/api/v1/fleets/by-token/${params.token}`);
        if (!resolveRes.ok) {
          const data = await resolveRes.json().catch(() => ({}));
          setError(data.error ?? "Invalid or expired join link");
          setStatus("error");
          return;
        }
        const { fleetId } = await resolveRes.json();

        const joinRes = await fetch(`/api/v1/fleets/${fleetId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinToken: params.token }),
        });

        if (!joinRes.ok) {
          const data = await joinRes.json().catch(() => ({}));
          setError(data.error ?? "Failed to join fleet");
          setStatus("error");
          return;
        }

        router.push(`/fleet/${fleetId}`);
      } catch {
        setError("Network error — please try again");
        setStatus("error");
      }
    };

    join();
  }, [params.token, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-fleet-bg flex items-center justify-center p-4">
        <div className="bg-fleet-surface border border-fleet-border rounded-lg p-8 w-full max-w-sm flex flex-col gap-4 text-center">
          <div className="text-red-400 text-4xl">✕</div>
          <h1 className="text-xl font-bold text-fleet-text">Unable to Join</h1>
          <p className="text-fleet-text-muted text-sm">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-fleet-accent hover:opacity-90 text-white font-semibold py-2 rounded-md transition-opacity text-sm"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fleet-bg flex items-center justify-center">
      <div className="text-fleet-text-muted text-sm">Joining fleet…</div>
    </div>
  );
}
