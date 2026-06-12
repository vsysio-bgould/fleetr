interface Props {
  title: string;
  titleColor?: string;
  children?: React.ReactNode;
}

export function PanelHeader({ title, titleColor, children }: Props) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3
        className="text-base font-display font-semibold uppercase tracking-[0.04em]"
        style={titleColor ? { color: titleColor } : undefined}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
