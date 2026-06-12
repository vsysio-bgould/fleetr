interface Props {
  title: string;
  children?: React.ReactNode;
}

export function AppWindowHeader({ title, children }: Props) {
  return (
    <div className="flex items-center justify-between h-10 px-3 border-b border-[#1f2a36] bg-[#0f141a] rounded-t shrink-0">
      <span className="uppercase tracking-[0.04em] text-sm font-medium text-[#9aa4b2] font-display">
        {title}
      </span>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
