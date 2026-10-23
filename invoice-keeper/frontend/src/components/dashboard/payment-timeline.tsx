"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimelineItem {
  id: number;
  name: string | null;
  amount: number | string | null;
  currency: string | null;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
  is_overdue: boolean;
}

export function PaymentTimeline({
  items,
  onTogglePaid,
}: {
  items: TimelineItem[];
  onTogglePaid: (item: TimelineItem) => void;
}) {
  const formatMoney = (amount: number | string | null, currency: string | null) => {
    if (amount == null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "RUB",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Sort by due_date desc
  const sorted = [...items].sort(
    (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-600 text-sm">
        История пуста
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/10" />

      <div className="space-y-0">
        {sorted.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35 }}
            className="relative flex gap-5 pb-8 last:pb-0"
          >
            {/* Dot */}
            <div className="relative z-10 flex-shrink-0 mt-1">
              <div
                className={cn(
                  "w-[31px] h-[31px] rounded-full border-2 flex items-center justify-center",
                  item.is_paid
                    ? "border-blue-500 bg-blue-500/20"
                    : item.is_overdue
                    ? "border-red-500 bg-red-500/10"
                    : "border-white/20 bg-[#0a0a0a]"
                )}
              >
                {item.is_paid ? (
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : item.is_overdue ? (
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-white/30" />
                )}
              </div>
            </div>

            {/* Content card */}
            <div
              className={cn(
                "flex-1 rounded-lg border p-4 transition-colors",
                item.is_overdue && !item.is_paid
                  ? "border-red-500/20 bg-red-500/[0.03]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-white text-sm truncate">
                      {item.name || "Без названия"}
                    </h4>
                    {item.is_overdue && !item.is_paid && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                        Просрочено
                      </span>
                    )}
                    {item.is_paid && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        Оплачено
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Срок: {item.due_date}</span>
                    {item.paid_at && <span>Факт: {item.paid_at}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {formatMoney(item.amount, item.currency)}
                  </span>
                  <button
                    onClick={() => onTogglePaid(item)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      item.is_paid
                        ? "border border-white/10 text-neutral-400 hover:bg-white/5"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    )}
                  >
                    {item.is_paid ? "Отменить" : "Оплачено"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
