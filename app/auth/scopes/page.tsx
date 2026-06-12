"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface ScopeInfo {
  scope: string;
  required: boolean;
  label: string;
  description: string;
  consequence: string;
}

interface ScopeSelectionData {
  scopes: ScopeInfo[];
  preference: string[] | null;
}

function ScopeSelectionPage() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";

  const [data, setData] = useState<ScopeSelectionData | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/auth/scope-selection")
      .then((r) => r.json())
      .then((body: { data: ScopeSelectionData }) => {
        const d = body.data;
        setData(d);
        setSelectedScopes(d.preference ?? d.scopes.filter((s) => s.required).map((s) => s.scope));
      })
      .catch(console.error);
  }, []);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const selectTier = (tier: string) => {
    if (!data) return;
    if (tier === "REQUIRED") {
      setSelectedScopes(data.scopes.filter((s) => s.required).map((s) => s.scope));
      return;
    }
    setSelectedScopes(data.scopes.map((s) => s.scope));
  };

  const handleContinue = async () => {
    if (!data) return;
    setLoading(true);
    try {
      await fetch("/api/v1/users/me/scope-preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: selectedScopes }),
      });
      const res = await fetch("/api/v1/auth/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: selectedScopes, returnUrl }),
      });
      const body = await res.json();
      const redirectUrl = body.data?.redirectUrl;

      if (!res.ok || !redirectUrl) {
        throw new Error(body.error?.message ?? "Failed to start EVE SSO login");
      }

      window.location.href = redirectUrl;
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-fleet-bg flex items-center justify-center">
        <div className="text-fleet-text-muted text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fleet-bg flex items-center justify-center p-4">
      <div className="bg-fleet-surface border border-fleet-border rounded-lg p-8 w-full max-w-lg flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-fleet-text">ESI Permissions</h1>
          <p className="text-fleet-text-muted text-sm mt-1">
            Choose which EVE Online data Fleetr can access.
          </p>
        </div>

        {/* Tier presets */}
        <div className="flex gap-2">
          {["REQUIRED", "ALL"].map((tier) => (
            <button
              key={tier}
              onClick={() => selectTier(tier)}
              className="flex-1 py-2 px-3 text-sm rounded border border-fleet-border text-fleet-text hover:border-fleet-accent transition-colors"
            >
              {tier.charAt(0) + tier.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Individual scope toggles */}
        <div className="flex flex-col gap-3">
          {data.scopes.map((gate) => (
            <label
              key={`${gate.scope}:${gate.label}`}
              className="flex items-start gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={selectedScopes.includes(gate.scope)}
                onChange={() => toggleScope(gate.scope)}
                className="mt-1 accent-fleet-accent"
              />
              <div>
                <div className="text-sm font-medium text-fleet-text">{gate.label}</div>
                <div className="text-xs text-fleet-text-muted">{gate.consequence}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleContinue}
          disabled={loading || selectedScopes.length === 0}
          className="w-full bg-fleet-accent hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-md transition-opacity"
        >
          {loading ? "Redirecting…" : "Continue to EVE SSO"}
        </button>
      </div>
    </div>
  );
}

export default function ScopeSelectionPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-fleet-bg flex items-center justify-center">
          <div className="text-fleet-text-muted text-sm">Loading…</div>
        </div>
      }
    >
      <ScopeSelectionPage />
    </Suspense>
  );
}
