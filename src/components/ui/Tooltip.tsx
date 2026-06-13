"use client";

import { useState, useRef } from "react";

interface Props {
  content: string;
  children: React.ReactNode;
  side?: "right" | "top" | "bottom";
}

export function Tooltip({ content, children, side = "right" }: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sideClass =
    side === "right"
      ? "left-full ml-2 top-1/2 -translate-y-1/2"
      : side === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : "top-full mt-2 left-1/2 -translate-x-1/2";

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-50 bg-slate-900/70 backdrop-blur-md border border-cyan-500/30 rounded-md shadow-lg text-xs p-3 pointer-events-none w-max max-w-[300px] whitespace-normal ${sideClass}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
