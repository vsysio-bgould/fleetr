import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export function FormSelect({ className = "", children, ...props }: Props) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-[#253140] bg-[#0f141a] px-2 py-1.5 text-[13px] text-[#e6edf3] outline-none focus:border-[#3fa7ff] transition ${className}`}
    >
      {children}
    </select>
  );
}
