export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface Props {
  status: ConnectionStatus;
}

const CONFIG: Record<ConnectionStatus, { label: string; dotClass: string }> = {
  connected: { label: "Connected", dotClass: "bg-green-400" },
  reconnecting: { label: "Reconnecting…", dotClass: "bg-yellow-400 animate-pulse" },
  disconnected: { label: "Disconnected", dotClass: "bg-red-500" },
};

export function ConnectionPill({ status }: Props) {
  const { label, dotClass } = CONFIG[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-fleet-text-muted">
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      {label}
    </div>
  );
}
