
"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimelineItem {
  id: number;
  recurring_payment_id: number;
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
  onTogglePaid: (item: TimelineItem) => void | Promise<void>;
}) {
  const formatMoney = (
    amount: number | string | null,
    currency: string | null
  ) => {
    if (amount == null) return "—";

    const num = typeof amount === "string" ? parseFloat(amount) : amount;

    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "RUB",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Сначала показываем ближайшие сроки, затем более поздние.
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-neutral-600">
        История пуста
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Вертикальная линия временной шкалы */}
      <div className="absolute bottom-2 left-[15px] top-2 w-px bg-white/10" />

      <div className="space-y-0">
        {sorted.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35 }}
            className="relative flex gap-5 pb-8 last:pb-0"
          >
            {/* Индикатор события */}
            <div className="relative z-10 mt-1 flex-shrink-0">
              <div
                className={cn(
                  "flex h-[31px] w-[31px] items-center justify-center rounded-full border-2",
                  item.is_paid
                    ? "border-blue-500 bg-blue-500/20"
                    : item.is_overdue
                      ? "border-red-500 bg-red-500/10"
                      : "border-white/20 bg-[#0a0a0a]"
                )}
              >
                {item.is_paid ? (
                  <svg
                    className="h-3.5 w-3.5 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : item.is_overdue ? (
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/30" />
                )}
              </div>
            </div>

            {/* Карточка платежа */}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-medium text-white">
                      {item.name || "Без названия"}
                    </h4>

                    {item.is_overdue && !item.is_paid && (
                      <span className="rounded border border-red-500/20 bg-red-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-400">
                        Просрочено
                      </span>
                    )}

                    {item.is_paid && (
                      <span className="rounded border border-blue-500/20 bg-blue-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-400">
                        Оплачено
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                    <span>Срок: {item.due_date}</span>
                    {item.paid_at && <span>Факт: {item.paid_at}</span>}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-3">
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-white">
                    {formatMoney(item.amount, item.currency)}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      void onTogglePaid(item);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      item.is_paid
                        ? "border border-white/10 text-neutral-400 hover:bg-white/5"
                        : "bg-blue-600 text-white hover:bg-blue-500"
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
