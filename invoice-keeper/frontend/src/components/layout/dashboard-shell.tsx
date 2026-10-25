"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./sidebar";
import { TgAssistant } from "./tg-assistant";
import { CardGlow } from "@/components/ui/card-glow";

// один экземпляр на всё приложение: не пересоздаётся при переходах между страницами
const Terrain3DBackground = dynamic(() => import("@/components/ui/terrain-3d-bg"), { ssr: false });

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div data-ambient className="relative min-h-screen bg-[#050505] text-neutral-100">
      <Terrain3DBackground ambient />
      <CardGlow />
      <div className="fixed inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_at_top,transparent_30%,#050505_95%)]" />

      <div className="relative z-10">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        {/* зона с данными — сплошная заливка как на «Платежах»; рельеф остаётся только за сайдбаром */}
        <div
          className="min-h-screen transition-all duration-300"
          style={{ paddingLeft: collapsed ? 96 : 288 }}
        >
          <div className="min-h-screen bg-[#08090b]">{children}</div>
        </div>

        <TgAssistant />
      </div>
    </div>
  );
}
