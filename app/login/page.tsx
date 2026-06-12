"use client";

import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";

  const handleLogin = async () => {
    const res = await fetch("/api/v1/auth/begin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopes: [
          "esi-fleets.read_fleet.v1",
          "esi-location.read_location.v1",
        ],
        returnUrl,
      }),
    });
    const { redirectUrl } = await res.json();
    window.location.href = redirectUrl;
  };

  return (
    <div className="min-h-screen bg-fleet-bg flex items-center justify-center">
      <div className="bg-fleet-surface border border-fleet-border rounded-lg p-8 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fleet-text tracking-wide">FLEETR</h1>
          <p className="text-fleet-text-muted text-sm mt-1">Fleet music for EVE Online</p>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-fleet-accent hover:opacity-90 text-white font-semibold py-3 px-6 rounded-md transition-opacity flex items-center justify-center gap-2"
        >
          <img
            src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-white-small.png"
            alt="Log in with EVE Online"
            className="h-5"
          />
        </button>

        <p className="text-xs text-fleet-text-muted text-center">
          Fleetr uses EVE Online SSO to verify your fleet membership.
          No passwords are stored.
        </p>
      </div>
    </div>
  );
}
