interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className = "" }: Props) {
  return (
    <div className={`rounded border border-[#1f2a36] bg-[#121821]/80 backdrop-blur-sm p-4 ${className}`}>
      {children}
    </div>
  );
}
