"use client";

import { useRouter } from "next/navigation";

export default function KickedPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-fleet-bg flex items-center justify-center p-4">
      <div className="bg-fleet-surface border border-fleet-border rounded-lg p-8 w-full max-w-sm flex flex-col gap-4 text-center">
        <div className="text-red-400 text-5xl">⚡</div>
        <h1 className="text-xl font-bold text-fleet-text">Removed from Fleet</h1>
        <p className="text-fleet-text-muted text-sm">
          You have been removed from the fleet by the Fleet Commander.
        </p>
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
