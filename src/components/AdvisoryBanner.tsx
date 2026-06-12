"use client";

import { useState } from "react";

interface Props {
  advisoryKey: string;
  message: string;
  onDismiss?: () => void;
}

export function AdvisoryBanner({ advisoryKey, message, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [permanent, setPermanent] = useState(false);

  const dismiss = async (perm: boolean) => {
    await fetch("/api/v1/users/me/advisories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: advisoryKey, permanent: perm }),
    });
    setDismissed(true);
    setPermanent(perm);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className="bg-fleet-surface border border-fleet-border rounded-lg p-4 flex items-start gap-3">
      <span className="text-yellow-400 text-lg mt-0.5">⚠</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fleet-text">{message}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => dismiss(false)}
            className="text-xs text-fleet-text-muted hover:text-fleet-text transition-colors"
          >
            Dismiss for 24h
          </button>
          <button
            onClick={() => dismiss(true)}
            className="text-xs text-fleet-text-muted hover:text-fleet-text transition-colors"
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
}
