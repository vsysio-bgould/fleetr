"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScopeGateKey } from "@/config/scope-gates";
import { SCOPE_GATES } from "@/config/scope-gates";

interface Props {
  gate: ScopeGateKey;
  returnUrl?: string;
}

function dismissKey(gate: ScopeGateKey): string {
  return `fleetr:scope-prompt-dismissed:${gate}`;
}

/**
 * Non-blocking inline prompt shown when a feature requires an ESI scope the
 * user has not granted (ESI-SCOPES §6.2). Dismiss hides it for the rest of
 * the browser session; reauth sends the user to the scope selection screen.
 */
export function ScopePrompt({ gate, returnUrl = "/" }: Props) {
  const router = useRouter();
  const { label, consequence, scope } = SCOPE_GATES[gate];
  const [dismissed, setDismissed] = useState(true); // hidden until storage checked

  useEffect(() => {
    setDismissed(sessionStorage.getItem(dismissKey(gate)) === "1");
  }, [gate]);

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey(gate), "1");
    setDismissed(true);
  };

  const handleReauth = () => {
    const params = new URLSearchParams({ returnUrl, highlight: scope });
    router.push(`/auth/scopes?${params}`);
  };

  if (dismissed) return null;

  return (
    <div className="bg-fleet-surface border border-amber-600/50 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-xl mt-0.5">🔒</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-fleet-text">{label} not enabled</div>
          <div className="text-xs text-fleet-text-muted mt-1">{consequence}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleReauth}
          className="flex-1 bg-fleet-accent hover:opacity-90 text-white text-sm font-semibold py-2 rounded-md transition-opacity"
        >
          Reauthenticate to enable
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 text-sm text-fleet-text-muted border border-fleet-border rounded-md hover:text-fleet-text transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
