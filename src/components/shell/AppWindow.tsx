interface Props {
  children: React.ReactNode;
  className?: string;
}

export function AppWindow({ children, className = "" }: Props) {
  return (
    <div className={`rounded border border-[#1f2a36] bg-[#121821]/80 backdrop-blur-sm shadow-lg flex flex-col flex-1 min-h-0 ${className}`}>
      {children}
    </div>
  );
}
