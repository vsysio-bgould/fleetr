interface Props {
  children: React.ReactNode;
  className?: string;
}

export function AppWindowBody({ children, className = "" }: Props) {
  return (
    <div className={`p-4 space-y-4 overflow-auto flex-1 ${className}`}>
      {children}
    </div>
  );
}
