"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
    } catch (err) {
      // Token may already be expired server-side; proceed to login regardless
      console.error(err);
    }
    window.location.href = "/login";
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={
        className ??
        "text-[11px] text-[#9aa4b2] hover:text-[#e6edf3] border border-[#1f2a36] hover:border-[#3fa7ff] rounded px-2 py-1 transition-colors disabled:opacity-50"
      }
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
