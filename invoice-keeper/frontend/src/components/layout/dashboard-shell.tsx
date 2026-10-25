"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TgAssistant } from "./tg-assistant";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <div
        className="min-h-screen transition-all duration-300"
        style={{ paddingLeft: collapsed ? 96 : 288 }}
      >
        {children}
      </div>

      <TgAssistant />
    </div>
  );
}
