"use client";

import { MemberRoster } from "@/components/MemberRoster";

export default function MembersPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-fleet-border">
        <h2 className="text-base font-semibold text-fleet-text">Members</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MemberRoster />
      </div>
    </div>
  );
}
