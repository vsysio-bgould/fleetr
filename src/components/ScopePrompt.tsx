"use client";

import { useRouter } from "next/navigation";
import type { ScopeGateKey } from "@/config/scope-gates";
import { SCOPE_GATES } from "@/config/scope-gates";

interface Props {
  gate: ScopeGateKey;
  returnUrl?: string;
}

export function ScopePrompt({ gate, returnUrl = "/" }: Props) {
  const router = useRouter();
  const { label, consequence, scope } = SCOPE_GATES[gate];

  const handleReauth = () => {
    const params = new URLSearchParams({ returnUrl, highlight: scope });
    router.push(`/auth/scopes?${params}`);
  };

  return (
    <div className="bg-fleet-surface border border-fleet-border rounded-lg p-5 flex flex-col gap-3 max-w-sm">
      <div className="flex items-start gap-3">
        <span className="text-fleet-accent text-xl mt-0.5">🔒</span>
        <div>
          <div className="text-sm font-semibold text-fleet-text">{label} required</div>
          <div className="text-xs text-fleet-text-muted mt-1">{consequence}</div>
        </div>
      </div>
      <button
        onClick={handleReauth}
        className="w-full bg-fleet-accent hover:opacity-90 text-white text-sm font-semibold py-2 rounded-md transition-opacity"
      >
        Grant Permission
      </button>
    </div>
  );
}
