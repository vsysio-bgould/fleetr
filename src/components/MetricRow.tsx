interface Props {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function MetricRow({ label, value, className = "" }: Props) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${className}`}>
      <span className="text-sm text-fleet-text-muted">{label}</span>
      <span className="text-sm font-medium text-fleet-text">{value}</span>
    </div>
  );
}
