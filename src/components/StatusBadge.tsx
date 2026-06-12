import type { SessionRole } from "@prisma/client";

interface Props {
  role: SessionRole;
  className?: string;
}

const ROLE_CONFIG: Record<SessionRole, { label: string; className: string }> = {
  FLEET_COMMANDER: { label: "FC", className: "bg-fleet-accent text-white" },
  FC_DELEGATE: { label: "Delegate", className: "bg-purple-600 text-white" },
  LINE_MEMBER: { label: "Member", className: "bg-fleet-surface text-fleet-text-muted border border-fleet-border" },
};

export function StatusBadge({ role, className = "" }: Props) {
  const { label, className: roleClass } = ROLE_CONFIG[role];
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${roleClass} ${className}`}>
      {label}
    </span>
  );
}
