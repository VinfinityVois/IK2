"use client";

import { cn } from "@/lib/utils";

interface SummaryItem {
  currency: string;
  total_amount: string;
  paid_amount: string;
  unpaid_amount: string;
  overdue_amount: string;
  count_paid: number;
  count_unpaid: number;
  count_overdue: number;
}

export function PaymentsCharts({ summary }: { summary: SummaryItem[] }) {
  if (!summary.length) return null;

  const max = Math.max(
    ...summary.map((s) => parseFloat(s.total_amount) || 0),
    1
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
        <div className="text-xs text-neutral-500 mb-4 uppercase tracking-wider">
          Суммы по валютам
        </div>
        <div className="space-y-4">
          {summary.map((s) => {
            const total = parseFloat(s.total_amount) || 0;
            const paid = parseFloat(s.paid_amount) || 0;
            const unpaid = parseFloat(s.unpaid_amount) || 0;
            return (
              <div key={s.currency}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-blue-400">{s.currency}</span>
                  <span className="text-neutral-400 tabular-nums">
                    {total.toLocaleString("ru-RU")}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden flex">
                  <div
                    className="h-full bg-green-500/80 transition-all duration-500"
                    style={{ width: `${(paid / max) * 100}%` }}
                  />
                  <div
                    className="h-full bg-blue-500/70 transition-all duration-500"
                    style={{ width: `${(unpaid / max) * 100}%` }}
                  />
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-neutral-600">
                  <span className="text-green-500">■ оплачено</span>
                  <span className="text-blue-400">■ ожидает</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
        <div className="text-xs text-neutral-500 mb-4 uppercase tracking-wider">
          Статусы (кол-во)
        </div>
        <div className="grid grid-cols-3 gap-3">
          {summary.map((s) => (
            <div
              key={s.currency}
              className="rounded-lg border border-white/[0.06] p-3 text-center"
            >
              <div className="text-lg font-semibold text-blue-400">{s.currency}</div>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="text-green-400">{s.count_paid} ✓</div>
                <div className="text-neutral-400">{s.count_unpaid} ○</div>
                <div className={cn(s.count_overdue ? "text-red-400" : "text-neutral-600")}>
                  {s.count_overdue} !
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
