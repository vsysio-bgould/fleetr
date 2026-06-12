"use client";

interface Props {
  mode: "CRUISE" | "BATTLE";
}

/**
 * Prominent banner shown while a track load is blocked by a pre-roll ad
 * (MEDIA-PLAYERS §7.2). Distinct from the standard YouTube Premium advisory.
 */
export function AdPendingBanner({ mode }: Props) {
  return (
    <div className="bg-amber-900/25 border border-amber-600 rounded px-3 py-2 flex flex-col gap-0.5">
      {mode === "BATTLE" && (
        <span className="text-amber-300 text-sm font-semibold">⚔ Battle mode active</span>
      )}
      <span className="text-amber-400 text-xs">
        Your track will start automatically after the current ad.
      </span>
    </div>
  );
}
