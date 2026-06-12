export type BadgeState = "active" | "idle" | "battle" | "cruise" | "pending" | "error";

interface Props {
  state: BadgeState;
  label?: string;
  className?: string;
}

const STATE_CONFIG: Record<BadgeState, { label: string; className: string }> = {
  active:  { label: "Active",   className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  idle:    { label: "Idle",     className: "bg-[#1f2a36] text-[#9aa4b2] border border-[#253140]" },
  battle:  { label: "Battle",   className: "bg-red-500/15 text-red-400 border border-red-500/30" },
  cruise:  { label: "Cruise",   className: "bg-[#3fa7ff]/15 text-[#3fa7ff] border border-[#3fa7ff]/30" },
  pending: { label: "Pending",  className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  error:   { label: "Error",    className: "bg-red-900/30 text-red-400 border border-red-500/30" },
};

export function StatusBadge({ state, label, className = "" }: Props) {
  const cfg = STATE_CONFIG[state];
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.className} ${className}`}>
      {label ?? cfg.label}
    </span>
  );
}
