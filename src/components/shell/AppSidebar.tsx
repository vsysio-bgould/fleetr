"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui/Tooltip";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  fleetId: string;
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <polygon points="4,2 16,9 4,16" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="6" r="3" />
      <path d="M1 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M14 8a2.5 2.5 0 1 0 0-5M17 16c0-2.8-1.8-5.1-4-5.8" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="3" y1="5" x2="15" y2="5" />
      <line x1="3" y1="9" x2="15" y2="9" />
      <line x1="3" y1="13" x2="15" y2="13" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.2 3.2l1.4 1.4M13.4 13.4l1.4 1.4M3.2 14.8l1.4-1.4M13.4 4.6l1.4-1.4" />
    </svg>
  );
}
function ConfigIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="12" height="12" rx="1.5" />
      <line x1="6" y1="7" x2="12" y2="7" />
      <line x1="6" y1="11" x2="10" y2="11" />
    </svg>
  );
}

export function AppSidebar({ fleetId }: Props) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: `/fleet/${fleetId}`, label: "Fleet Room", icon: <PlayIcon /> },
    { href: `/fleet/${fleetId}/members`, label: "Members", icon: <UsersIcon /> },
    { href: `/fleet/${fleetId}/queue`, label: "Queue", icon: <ListIcon /> },
    { href: `/fleet/${fleetId}/configuration`, label: "Fleet Configuration", icon: <ConfigIcon /> },
    { href: `/fleet/${fleetId}/settings`, label: "Settings", icon: <GearIcon /> },
  ];

  return (
    <aside className="flex flex-col items-center w-12 bg-[#0b0f14] border-r border-[#1f2a36] py-2 gap-2 shrink-0">
      {/* Brand mark */}
      <div className="w-10 h-10 flex items-center justify-center mb-2">
        <span className="text-[#3fa7ff] font-bold text-[10px] leading-none tracking-widest">FLT</span>
      </div>

      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Tooltip key={item.href} content={item.label} side="right">
            <Link
              href={item.href}
              className={`w-10 h-10 flex items-center justify-center rounded transition ${
                active
                  ? "bg-[#18212c] text-[#3fa7ff]"
                  : "text-[#9aa4b2] hover:bg-[#18212c] hover:text-[#e6edf3]"
              }`}
            >
              {item.icon}
            </Link>
          </Tooltip>
        );
      })}
    </aside>
  );
}
