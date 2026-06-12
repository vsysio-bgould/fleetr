type Variant = "live" | "healthy" | "warning" | "danger" | "muted";

interface Props {
  variant: Variant;
  className?: string;
}

const COLORS: Record<Variant, string> = {
  live: "bg-[#22c55e]",
  healthy: "bg-[#22c55e]",
  warning: "bg-[#f59e0b]",
  danger: "bg-[#ef4444]",
  muted: "bg-[#6b7280]",
};

export function StatusDot({ variant, className = "" }: Props) {
  return <span className={`inline-block h-2 w-2 rounded-full ${COLORS[variant]} ${className}`} />;
}
