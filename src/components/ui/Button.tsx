import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#3fa7ff] text-white hover:brightness-110 disabled:opacity-50",
  secondary: "border border-[#2b3645] bg-transparent text-[#e6edf3] hover:bg-[#18212c] disabled:opacity-50",
  danger: "bg-[#ef4444] text-white hover:brightness-110 disabled:opacity-50",
  ghost: "text-[#9aa4b2] hover:text-[#e6edf3] hover:bg-[#18212c] disabled:opacity-50",
};

export function Button({ variant = "primary", className = "", children, ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
