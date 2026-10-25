"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/overview", label: "Обзор", icon: "▦" },
  { href: "/dashboard", label: "Платежи", icon: "💳" },
  { href: "/banks", label: "Банки & Счета", icon: "🏦" },
  { href: "/calendar", label: "Календарь", icon: "📅" },
  { href: "/forecast", label: "Прогноз & Анализ", icon: "📊" },
  { href: "/users", label: "Пользователи", icon: "👥", admin: true },
  { href: "/settings", label: "Настройки", icon: "⚙️" },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const items = nav.filter((n) => !n.admin || user?.role === "admin");

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-white/[0.06] bg-[#0a0a0a]"
    >
      <div className="h-14 flex items-center gap-3 px-3 border-b border-white/[0.06]">
        <button
          onClick={onToggle}
          className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0 hover:bg-blue-500"
        >
          IK
        </button>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-sm font-semibold truncate">Invoice Keeper</div>
              <div className="text-[10px] text-neutral-600 tracking-wider">FINANCIAL OPS</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-colors",
                active
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/20"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              )}
            >
              <span className="w-6 text-center text-base shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-2">
        <div className={cn("flex items-center gap-2.5 rounded-xl px-2 py-2", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
            {(user?.username?.[0] || "U").toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{user?.username}</div>
                <div className="text-[10px] text-neutral-500 uppercase">{user?.role}</div>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="text-neutral-600 hover:text-red-400 text-xs"
                title="Выйти"
              >
                ⎋
              </button>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}