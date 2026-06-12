"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";

  const handleLogin = () => {
    const params = new URLSearchParams({ returnUrl });
    router.push(`/auth/scopes?${params.toString()}`);
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
          <Image
            src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-white-small.png"
            alt="Log in with EVE Online"
            width={195}
            height={30}
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
