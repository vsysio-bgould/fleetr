interface Props {
  yesVotes: number;
  noVotes: number;
}

export function ProgressBar({ yesVotes, noVotes }: Props) {
  const total = yesVotes + noVotes;
  const yesPct = total > 0 ? Math.round((yesVotes / total) * 100) : 0;

  return (
    <div className="flex-1 h-1 bg-fleet-muted rounded overflow-hidden">
      <div
        className="h-full bg-green-500 transition-all duration-300"
        style={{ width: `${yesPct}%` }}
      />
    </div>
  );
}
