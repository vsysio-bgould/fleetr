"use client";

import { useCallback, useEffect, useState } from "react";
import { ScopePrompt } from "@/components/ScopePrompt";
import { useFleet } from "@/contexts/FleetContext";
import { Tooltip } from "@/components/ui/Tooltip";
import { sanitizeBasicHtml } from "@/lib/sanitize-html";

interface FleetConfiguration {
  motd: string;
  isFreeMove: boolean;
  isRegistered: boolean;
  isVoiceEnabled: boolean;
  joinUrl: string;
}

export default function FleetConfigurationPage() {
  const { fleetId } = useFleet();
  const [config, setConfig] = useState<FleetConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      const res = await fetch(`/api/v1/fleets/${fleetId}/configuration`);
      const body = await res.json();
      if (!res.ok) {
        setErrorCode(body.error?.code ?? "ERROR");
        return;
      }
      setConfig(body.data);
    } finally {
      setLoading(false);
    }
  }, [fleetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const appendLink = async () => {
    setSaving(true);
    setErrorCode(null);
    try {
      const res = await fetch(`/api/v1/fleets/${fleetId}/configuration`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setErrorCode(body.error?.code ?? "ERROR");
        return;
      }
      setConfig(body.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-fleet-border">
        <h2 className="text-base font-semibold text-fleet-text">Fleet Configuration</h2>
      </div>

      <div className="p-6 flex flex-col gap-4 max-w-3xl">
        {errorCode === "SCOPE_NOT_GRANTED" && (
          <ScopePrompt gate="FLEET_WRITE" returnUrl={`/fleet/${fleetId}/configuration`} />
        )}

        {loading && <div className="text-sm text-fleet-text-muted">Loading fleet configuration...</div>}

        {config && (
          <>
            <section className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded border border-fleet-border bg-fleet-surface p-3">
                <div className="text-xs text-fleet-text-muted">Free Move</div>
                <div className="text-fleet-text">{config.isFreeMove ? "Enabled" : "Disabled"}</div>
              </div>
              <div className="rounded border border-fleet-border bg-fleet-surface p-3">
                <div className="text-xs text-fleet-text-muted">Registered</div>
                <div className="text-fleet-text">{config.isRegistered ? "Yes" : "No"}</div>
              </div>
              <div className="rounded border border-fleet-border bg-fleet-surface p-3">
                <div className="text-xs text-fleet-text-muted">Voice</div>
                <div className="text-fleet-text">{config.isVoiceEnabled ? "Enabled" : "Disabled"}</div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-fleet-text">Fleet MOTD</h3>
                <Tooltip content="Append the Fleetr join link to the EVE fleet MOTD" side="top">
                  <button
                    onClick={appendLink}
                    disabled={saving || config.motd.includes(config.joinUrl)}
                    className="px-3 py-2 text-sm rounded border border-fleet-border text-fleet-text hover:border-fleet-accent disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Appending..." : "Append Fleetr Link"}
                  </button>
                </Tooltip>
              </div>
              {config.motd ? (
                <div
                  className="min-h-40 rounded border border-fleet-border bg-[#0f141a] p-4 text-sm text-fleet-text overflow-auto [&_*]:!text-sm [&_*]:leading-snug"
                  dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(config.motd) }}
                />
              ) : (
                <div className="min-h-40 rounded border border-fleet-border bg-[#0f141a] p-4 text-sm text-fleet-text-muted">
                  No MOTD set
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
