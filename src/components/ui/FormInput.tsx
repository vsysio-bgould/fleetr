import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {}

export function FormInput({ className = "", ...props }: Props) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-[#253140] bg-[#0f141a] px-2 py-1.5 text-[13px] text-[#e6edf3] outline-none focus:border-[#3fa7ff] transition placeholder-[#6b7280] ${className}`}
    />
  );
}
