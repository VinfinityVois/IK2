"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPaymentOccurrences, updatePaymentOccurrence } from "@/lib/api";
import { cn } from "@/lib/utils";

const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

type Occurrence = {
  id: number;
  recurring_payment_id: number;
  name?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  due_date: string;
  is_paid: boolean;
  paid_at?: string | null;
  is_overdue: boolean;
};

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(amount: number, currency = "RUB") {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ru-RU")} ${currency}`;
  }
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDue(s: string) {
  // YYYY-MM-DD
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return { y, m: m - 1, d };
}

export default function CalendarPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string>(() =>
    isoDate(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [items, setItems] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPaymentOccurrences();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of items) {
      const key = o.due_date.slice(0, 10);
      const list = map.get(key) || [];
      list.push(o);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const start = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < start; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [ym]);

  const monthItems = useMemo(() => {
    return items.filter((o) => {
      const { y, m } = parseDue(o.due_date);
      return y === ym.y && m === ym.m;
    });
  }, [items, ym]);

  /** Итоги месяца: по валютам (всего / к оплате / оплачено / просрочено) */
  const monthTotals = useMemo(() => {
    const acc: Record<
      string,
      { total: number; unpaid: number; paid: number; overdue: number; count: number }
    > = {};
    for (const o of monthItems) {
      const cur = (o.currency || "RUB").toUpperCase();
      if (!acc[cur]) acc[cur] = { total: 0, unpaid: 0, paid: 0, overdue: 0, count: 0 };
      const a = toNum(o.amount);
      acc[cur].total += a;
      acc[cur].count += 1;
      if (o.is_paid) acc[cur].paid += a;
      else {
        acc[cur].unpaid += a;
        if (o.is_overdue) acc[cur].overdue += a;
      }
    }
    return acc;
  }, [monthItems]);

  /** Ближайшие 7 дней от сегодня */
  const next7 = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return items.filter((o) => {
      if (o.is_paid) return false;
      const d = new Date(o.due_date.slice(0, 10) + "T00:00:00");
      return d >= today && d <= end;
    });
  }, [items]);

  const next7ByCur = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const o of next7) {
      const cur = (o.currency || "RUB").toUpperCase();
      acc[cur] = (acc[cur] || 0) + toNum(o.amount);
    }
    return acc;
  }, [next7]);

  const overdueItems = useMemo(
    () => items.filter((o) => o.is_overdue && !o.is_paid),
    [items]
  );

  const overdueByCur = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const o of overdueItems) {
      const cur = (o.currency || "RUB").toUpperCase();
      acc[cur] = (acc[cur] || 0) + toNum(o.amount);
    }
    return acc;
  }, [overdueItems]);

  const dayItems = byDate.get(selected) || [];

  const dayTotals = useMemo(() => {
    const acc: Record<
      string,
      { total: number; unpaid: number; paid: number; overdue: number }
    > = {};
    for (const o of dayItems) {
      const cur = (o.currency || "RUB").toUpperCase();
      if (!acc[cur]) acc[cur] = { total: 0, unpaid: 0, paid: 0, overdue: 0 };
      const a = toNum(o.amount);
      acc[cur].total += a;
      if (o.is_paid) acc[cur].paid += a;
      else {
        acc[cur].unpaid += a;
        if (o.is_overdue) acc[cur].overdue += a;
      }
    }
    return acc;
  }, [dayItems]);

  const shiftMonth = (delta: number) => {
    setYm((prev) => {
      const d = new Date(prev.y, prev.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const markPaid = async (id: number) => {
    setPayingId(id);
    try {
      await updatePaymentOccurrence(id, {
        is_paid: true,
        paid_at: new Date().toISOString().slice(0, 10),
      });
      showToast("Отмечено оплаченным");
      await load();
    } catch {
      showToast("Ошибка обновления");
    } finally {
      setPayingId(null);
    }
  };

  const todayIso = isoDate(now.getFullYear(), now.getMonth(), now.getDate());

  const formatCurLine = (map: Record<string, number>) => {
    const keys = Object.keys(map);
    if (keys.length === 0) return "—";
    return keys.map((c) => fmtMoney(map[c], c)).join(" · ");
  };

  return (
    <div className="w-full px-6 lg:px-10 py-8 pb-20">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Календарь оплат</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Сроки, итоги по датам и валютам (RUB · USD · EUR)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="h-9 w-9 rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.06]"
            title="Предыдущий месяц"
          >
            ‹
          </button>
          <span className="min-w-[140px] text-center px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium">
            {MONTHS[ym.m]} {ym.y}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="h-9 w-9 rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.06]"
            title="Следующий месяц"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => {
              setYm({ y: now.getFullYear(), m: now.getMonth() });
              setSelected(todayIso);
            }}
            className="h-9 px-3 rounded-lg border border-white/10 text-xs text-neutral-300 hover:bg-white/[0.06]"
          >
            Сегодня
          </button>
          <Link
            href="/dashboard"
            className="h-9 px-3 rounded-lg bg-blue-600 text-sm text-white hover:bg-blue-500 inline-flex items-center"
          >
            + Платёж
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Всего в месяце
          </div>
          <div className="text-lg font-semibold mt-1 tabular-nums">
            {monthItems.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
            {Object.keys(monthTotals).length === 0
              ? "—"
              : Object.entries(monthTotals)
                  .map(([c, v]) => fmtMoney(v.total, c))
                  .join(" · ")}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Ближайшие 7 дней
          </div>
          <div className="text-lg font-semibold mt-1 tabular-nums text-amber-300">
            {next7.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {formatCurLine(next7ByCur)}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Просрочено
          </div>
          <div className="text-lg font-semibold mt-1 tabular-nums text-rose-400">
            {overdueItems.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {formatCurLine(overdueByCur)}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            К оплате в месяце
          </div>
          <div className="text-sm font-semibold mt-1 leading-relaxed">
            {Object.keys(monthTotals).length === 0
              ? "—"
              : Object.entries(monthTotals)
                  .map(([c, v]) => (
                    <div key={c} className="tabular-nums">
                      {fmtMoney(v.unpaid, c)}
                      {v.overdue > 0 && (
                        <span className="text-rose-400 text-[11px] ml-1">
                          (проср. {fmtMoney(v.overdue, c)})
                        </span>
                      )}
                    </div>
                  ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Grid */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEK.map((w) => (
                  <div
                    key={w}
                    className="text-center text-[10px] text-neutral-500 py-1 font-medium"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (d == null) {
                    return (
                      <div
                        key={i}
                        className="min-h-[88px] rounded-lg border border-transparent opacity-20"
                      />
                    );
                  }
                  const key = isoDate(ym.y, ym.m, d);
                  const dayList = byDate.get(key) || [];
                  const hasOverdue = dayList.some((x) => x.is_overdue && !x.is_paid);
                  const hasUnpaid = dayList.some((x) => !x.is_paid);
                  const isSelected = selected === key;
                  const isToday = key === todayIso;

                  // mini totals by currency for dots
                  const dayCur: Record<string, number> = {};
                  for (const o of dayList) {
                    if (o.is_paid) continue;
                    const c = (o.currency || "RUB").toUpperCase();
                    dayCur[c] = (dayCur[c] || 0) + toNum(o.amount);
                  }

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelected(key)}
                      className={cn(
                        "min-h-[88px] rounded-lg border p-1.5 text-left text-xs transition-colors",
                        isSelected
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-white/[0.04] bg-white/[0.02] hover:border-white/15",
                        isToday && !isSelected && "ring-1 ring-white/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "font-medium",
                            isToday ? "text-blue-400" : "text-neutral-400"
                          )}
                        >
                          {d}
                        </span>
                        {dayList.length > 0 && (
                          <span
                            className={cn(
                              "text-[10px] tabular-nums",
                              hasOverdue
                                ? "text-rose-400"
                                : hasUnpaid
                                ? "text-amber-300"
                                : "text-emerald-400"
                            )}
                          >
                            {dayList.length}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(dayCur)
                          .slice(0, 3)
                          .map(([c, sum]) => (
                            <div
                              key={c}
                              className="truncate text-[10px] text-neutral-500 tabular-nums"
                            >
                              {c} {sum.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}
                            </div>
                          ))}
                        {dayList.filter((x) => x.is_paid).length > 0 &&
                          Object.keys(dayCur).length === 0 && (
                            <div className="text-[10px] text-emerald-500/80">оплачено</div>
                          )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Day panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium">
                  {selected === todayIso ? "Сегодня" : selected}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {dayItems.length} обязательств
                </div>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="text-xs text-neutral-500 hover:text-white"
              >
                Обновить
              </button>
            </div>

            {/* Day totals by currency */}
            {Object.keys(dayTotals).length > 0 && (
              <div className="mb-3 grid grid-cols-1 gap-2">
                {Object.entries(dayTotals).map(([c, v]) => (
                  <div
                    key={c}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between font-medium">
                      <span className="text-neutral-400">{c}</span>
                      <span className="tabular-nums">{fmtMoney(v.total, c)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-neutral-500">
                      <span>к оплате {fmtMoney(v.unpaid, c)}</span>
                      <span className="text-emerald-500/80">
                        оплачено {fmtMoney(v.paid, c)}
                      </span>
                      {v.overdue > 0 && (
                        <span className="text-rose-400">
                          проср. {fmtMoney(v.overdue, c)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {dayItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-neutral-600 text-center">
                  Нет платежей на эту дату
                </div>
              ) : (
                dayItems.map((o) => (
                  <div
                    key={o.id}
                    className={cn(
                      "rounded-lg border px-3 py-2.5",
                      o.is_overdue && !o.is_paid
                        ? "border-rose-500/30 bg-rose-500/5"
                        : "border-white/[0.06] bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {o.name || `#${o.id}`}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5 flex flex-wrap gap-x-2">
                          <span className="tabular-nums">
                            {fmtMoney(toNum(o.amount), o.currency || "RUB")}
                          </span>
                          {o.is_paid && (
                            <span className="text-emerald-400">
                              оплачено{o.paid_at ? ` · ${o.paid_at}` : ""}
                            </span>
                          )}
                          {o.is_overdue && !o.is_paid && (
                            <span className="text-rose-400">просрочено</span>
                          )}
                        </div>
                      </div>
                      {!o.is_paid && (
                        <button
                          type="button"
                          disabled={payingId === o.id}
                          onClick={() => void markPaid(o.id)}
                          className="shrink-0 px-2.5 py-1 rounded-md bg-blue-600 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {payingId === o.id ? "…" : "Оплачено"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Month by currency breakdown */}
          <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
            <div className="text-sm font-medium mb-3">
              Итоги {MONTHS[ym.m].toLowerCase()} · по валютам
            </div>
            {Object.keys(monthTotals).length === 0 ? (
              <div className="text-xs text-neutral-600">Нет данных за месяц</div>
            ) : (
              <div className="space-y-2">
                {Object.entries(monthTotals).map(([c, v]) => (
                  <div
                    key={c}
                    className="rounded-lg border border-white/[0.06] px-3 py-2.5"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{c}</span>
                      <span className="tabular-nums text-neutral-300">
                        {fmtMoney(v.total, c)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
                      <div>
                        <div className="text-neutral-600">К оплате</div>
                        <div className="tabular-nums text-amber-300/90">
                          {fmtMoney(v.unpaid, c)}
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-600">Оплачено</div>
                        <div className="tabular-nums text-emerald-400/90">
                          {fmtMoney(v.paid, c)}
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-600">Просрочка</div>
                        <div className="tabular-nums text-rose-400/90">
                          {fmtMoney(v.overdue, c)}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-neutral-600 mt-1">
                      {v.count} записей
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
