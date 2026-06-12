"use client";

import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  active: "CRUISE" | "BATTLE";
  cruiseCount: number;
  battleCount: number;
  onChange: (tab: "CRUISE" | "BATTLE") => void;
}

export function QueueTab({ active, cruiseCount, battleCount, onChange }: Props) {
  const tabs: { key: "CRUISE" | "BATTLE"; label: string; count: number }[] = [
    { key: "CRUISE", label: "Cruise", count: cruiseCount },
    { key: "BATTLE", label: "Battle", count: battleCount },
  ];

  return (
    <div className="flex border-b border-[#1f2a36] shrink-0">
      {tabs.map((tab) => (
        <Tooltip key={tab.key} content={`Show ${tab.label.toLowerCase()} queue`} side="bottom">
          <button
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium uppercase tracking-[0.06em] border-b-2 -mb-px transition ${
              active === tab.key
                ? "border-[#3fa7ff] text-[#3fa7ff]"
                : "border-transparent text-[#9aa4b2] hover:text-[#e6edf3]"
            }`}
          >
            {tab.label}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal ${
                active === tab.key
                  ? "bg-[#3fa7ff]/15 text-[#3fa7ff]"
                  : "bg-[#1f2a36] text-[#9aa4b2]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
