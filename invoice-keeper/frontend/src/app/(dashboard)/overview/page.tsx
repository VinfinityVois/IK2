"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  getPaymentOccurrences,
  getPaymentsSummary,
  updatePaymentOccurrence,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

type Occurrence = {
  id: number;
  name?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  due_date: string;
  is_paid: boolean;
  paid_at?: string | null;
  is_overdue: boolean;
};

type CurrencySummary = {
  currency: string;
  total_amount: number | string;
  paid_amount: number | string;
  unpaid_amount: number | string;
  overdue_amount: number | string;
  count_total: number;
  count_paid: number;
  count_unpaid: number;
  count_overdue: number;
};

const num = (v: number | string | null | undefined) => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (value: number | string | null | undefined, currency = "RUB") => {
  const n = num(value);
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "RUB" ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString("ru-RU")} ${currency}`;
  }
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function OverviewPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Occurrence[]>([]);
  const [summary, setSummary] = useState<CurrencySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unpaid" | "overdue" | "paid">("all");
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [occ, sum] = await Promise.all([
        getPaymentOccurrences(),
        getPaymentsSummary().catch(() => ({ by_currency: [] as CurrencySummary[] })),
      ]);
      setItems(occ.items || []);
      setSummary(sum.by_currency || []);
    } catch (e) {
      console.error(e);
      showToast("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const unpaid = items.filter((x) => !x.is_paid);
    const overdue = unpaid.filter((x) => x.is_overdue);
    const paid = items.filter((x) => x.is_paid);
    const upcoming = unpaid
      .filter((x) => !x.is_overdue)
      .slice()
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 8);

    const byCur: Record<string, { unpaid: number; overdue: number; paid: number }> = {};
    for (const s of summary) {
      byCur[s.currency] = {
        unpaid: num(s.unpaid_amount),
        overdue: num(s.overdue_amount),
        paid: num(s.paid_amount),
      };
    }
    if (summary.length === 0) {
      for (const x of items) {
        const c = x.currency || "RUB";
        if (!byCur[c]) byCur[c] = { unpaid: 0, overdue: 0, paid: 0 };
        const a = num(x.amount);
        if (x.is_paid) byCur[c].paid += a;
        else {
          byCur[c].unpaid += a;
          if (x.is_overdue) byCur[c].overdue += a;
        }
      }
    }

    const rubUnpaid = byCur.RUB?.unpaid ?? 0;
    const rubOverdue = byCur.RUB?.overdue ?? 0;
    const rubPaid = byCur.RUB?.paid ?? 0;
    const totalRub = rubUnpaid + rubPaid;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    const next30 = unpaid.filter((x) => {
      const d = new Date(`${x.due_date.slice(0, 10)}T12:00:00`);
      return d >= start && d < end;
    });
    const next30Sum = next30.reduce((s, x) => s + num(x.amount), 0);

    const recent = [...items]
      .sort((a, b) => b.due_date.localeCompare(a.due_date))
      .slice(0, 12);

    const limitPct =
      totalRub > 0 ? Math.min(100, Math.round((rubPaid / totalRub) * 100)) : 0;

    return {
      unpaid,
      overdue,
      paid,
      upcoming,
      byCur,
      rubUnpaid,
      rubOverdue,
      rubPaid,
      totalRub,
      next30,
      next30Sum,
      recent,
      total: items.length,
      limitPct,
    };
  }, [items, summary]);

  const markPaid = async (id: number) => {
    setPayingId(id);
    try {
      await updatePaymentOccurrence(id, { is_paid: true });
      showToast("Отмечено оплаченным");
      await load();
    } catch {
      showToast("Ошибка обновления");
    } finally {
      setPayingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "unpaid") return stats.recent.filter((x) => !x.is_paid);
    if (filter === "overdue") return stats.recent.filter((x) => x.is_overdue && !x.is_paid);
    if (filter === "paid") return stats.recent.filter((x) => x.is_paid);
    return stats.recent;
  }, [filter, stats.recent]);

  const name = user?.username || "пользователь";
  const currencies = Object.keys(stats.byCur);

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString("ru-RU", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }, []);

  const notifications = useMemo(() => {
    const list: {
      id: string;
      title: string;
      body: string;
      tone: "rose" | "amber" | "blue" | "emerald";
      href?: string;
    }[] = [];
    if (stats.overdue.length > 0) {
      list.push({
        id: "overdue",
        title: "Просроченные платежи",
        body: `${stats.overdue.length} обязательств на ${fmtMoney(stats.rubOverdue)}`,
        tone: "rose",
        href: "/overview",
      });
    }
    if (stats.next30.length > 0) {
      list.push({
        id: "next30",
        title: "Ближайшие 30 дней",
        body: `${stats.next30.length} платежей · ${fmtMoney(stats.next30Sum)}`,
        tone: "amber",
        href: "/calendar",
      });
    }
    if (stats.upcoming[0]) {
      const u = stats.upcoming[0];
      list.push({
        id: `up-${u.id}`,
        title: "Следующий платёж",
        body: `${u.name || `#${u.id}`} · ${fmtDate(u.due_date)} · ${fmtMoney(u.amount, u.currency || "RUB")}`,
        tone: "blue",
        href: "/dashboard",
      });
    }
    if (list.length === 0) {
      list.push({
        id: "ok",
        title: "Всё спокойно",
        body: "Нет срочных уведомлений по обязательствам",
        tone: "emerald",
      });
    }
    return list;
  }, [stats]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notifOpen]);

  const iconBtn =
    "relative w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors";

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-white/[0.06] bg-[#0a0a0a]/85 backdrop-blur-xl px-6 flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full hidden sm:block">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          <input
            className="w-full h-9 pl-9 pr-12 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            placeholder="Поиск платежей, счетов..."
            readOnly
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-neutral-500 font-mono">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Date */}
          <div className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-neutral-300">
            <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="capitalize">{todayLabel}</span>
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => void load()}
            className="h-9 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-neutral-300 hover:bg-white/[0.08] transition-colors inline-flex items-center gap-1.5"
            title="Обновить"
          >
            <svg
              className={cn("w-4 h-4", loading && "animate-spin")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Обновить</span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className={iconBtn}
              onClick={() => setNotifOpen((o) => !o)}
              aria-expanded={notifOpen}
              title="Уведомления"
            >
              <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {stats.overdue.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0a0a0a]" />
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-sm font-semibold">Уведомления</span>
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                    {notifications.length}
                  </span>
                </div>
                <ul className="max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="flex gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors"
                        >
                          <span
                            className={cn(
                              "mt-1 w-2 h-2 rounded-full shrink-0",
                              n.tone === "rose" && "bg-rose-400",
                              n.tone === "amber" && "bg-amber-400",
                              n.tone === "blue" && "bg-blue-400",
                              n.tone === "emerald" && "bg-emerald-400"
                            )}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white">{n.title}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{n.body}</div>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex gap-3 px-4 py-3">
                          <span className="mt-1 w-2 h-2 rounded-full shrink-0 bg-emerald-400" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white">{n.title}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{n.body}</div>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Settings */}
          <Link href="/settings" className={iconBtn} title="Настройки">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* User badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/[0.06] ml-0.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
              {(name[0] || "U").toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col leading-tight pr-1">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-[10px] text-neutral-500 uppercase">{user?.role || "user"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 pb-20">
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}

        {/* Rates / status strip */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#0c0c0c]/90 backdrop-blur-md p-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 pl-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Сводка · БД
            </span>
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span>
                К оплате{" "}
                <strong className="text-white">{fmtMoney(stats.rubUnpaid)}</strong>
              </span>
              <span className="text-neutral-700">|</span>
              <span>
                Просрочено{" "}
                <strong className="text-rose-400">{fmtMoney(stats.rubOverdue)}</strong>
              </span>
              <span className="text-neutral-700">|</span>
              <span>
                30 дней{" "}
                <strong className="text-white">{fmtMoney(stats.next30Sum)}</strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {stats.overdue.length === 0 ? "Без просрочек" : `${stats.overdue.length} просроч.`}
            </span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors"
            >
              + Платёж
            </Link>
          </div>
        </div>

        {/* Hero bento */}
        <div className="grid grid-cols-12 gap-4 mb-5">
          {/* Master balance */}
          <div className="col-span-12 xl:col-span-5 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1220] via-[#121a2e] to-blue-900/80 p-6 text-white shadow-xl min-h-[220px] flex flex-col justify-between">
            <div className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 bg-blue-500/25 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute right-0 bottom-0 w-40 h-40 bg-blue-600/20 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                    Обязательства к оплате
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold">
                    RUB + FX
                  </span>
                </div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none mb-2">
                {fmtMoney(stats.rubUnpaid)}
              </h2>
              <div className="flex items-center gap-3 mb-6 text-sm text-white/70">
                <span>Оплачено: {fmtMoney(stats.rubPaid)}</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 text-[10px] font-bold">
                  ↑ {stats.paid.length} из {stats.total}
                </span>
              </div>
            </div>
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { href: "/dashboard", label: "Платежи", icon: "→" },
                { href: "/calendar", label: "Календарь", icon: "◷" },
                { href: "/forecast", label: "Прогноз", icon: "↗" },
                { href: "/banks", label: "Счета", icon: "▣" },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl bg-white/10 hover:bg-white text-white hover:text-neutral-900 backdrop-blur-md transition-all"
                >
                  <span className="text-sm opacity-80 group-hover:opacity-100">{a.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Currency cards */}
          <div className="col-span-12 xl:col-span-4 grid grid-cols-2 gap-3">
            {(currencies.length ? currencies : ["RUB", "USD"]).slice(0, 2).map((cur) => {
              const c = stats.byCur[cur] || { unpaid: 0, paid: 0, overdue: 0 };
              return (
                <div
                  key={cur}
                  className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-4 flex flex-col justify-between hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center font-bold text-lg">
                      {cur === "RUB" ? "₽" : cur === "EUR" ? "€" : "$"}
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase">
                      {cur}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      К оплате
                    </span>
                    <div className="text-xl font-bold mt-0.5 leading-tight">
                      {fmtMoney(c.unpaid, cur)}
                    </div>
                    <span className="text-xs text-neutral-500">
                      оплачено {fmtMoney(c.paid, cur)}
                    </span>
                  </div>
                  <div className="mt-3 pt-2 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-neutral-500 bg-white/[0.03] px-2 py-1.5 rounded-lg">
                    <span>Просрочка</span>
                    <span className={cn(c.overdue > 0 ? "text-rose-400" : "text-emerald-400")}>
                      {fmtMoney(c.overdue, cur)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0c0c0c] border border-white/[0.06] flex items-center justify-center text-blue-400 text-lg">
                  ⏳
                </div>
                <div>
                  <div className="text-sm font-semibold">Ближайшие 30 дней</div>
                  <div className="text-xs text-neutral-500">
                    {stats.next30.length} обязательств
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono">{fmtMoney(stats.next30Sum)}</div>
                <div className="text-[10px] text-neutral-500 uppercase">резерв</div>
              </div>
            </div>
          </div>

          {/* Progress / risk */}
          <div className="col-span-12 xl:col-span-3 rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Исполнение обязательств
              </span>
            </div>
            <div className="relative flex flex-col items-center justify-center my-2">
              <svg className="w-44 h-24 overflow-visible" viewBox="0 0 160 90">
                <path
                  className="text-white/10"
                  d="M 20 80 A 60 60 0 0 1 140 80"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="12"
                />
                <path
                  className="text-blue-500 transition-all duration-700"
                  d="M 20 80 A 60 60 0 0 1 140 80"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="188.5"
                  strokeDashoffset={188.5 * (1 - stats.limitPct / 100)}
                  strokeLinecap="round"
                  strokeWidth="12"
                />
              </svg>
              <div className="absolute bottom-1 flex flex-col items-center">
                <span className="text-3xl font-bold leading-none">{stats.limitPct}%</span>
                <span className="text-[10px] text-neutral-500 mt-0.5">
                  {stats.paid.length} / {stats.total}
                </span>
              </div>
            </div>
            <div className="bg-white/[0.03] p-2.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    stats.overdue.length === 0 ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  )}
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold">
                    {stats.overdue.length === 0 ? "Риск: низкий" : "Есть просрочки"}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {stats.overdue.length} из {stats.unpaid.length} неоплач.
                  </span>
                </div>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                {stats.overdue.length === 0 ? "OK" : stats.overdue.length}
              </span>
            </div>
          </div>
        </div>

        {/* Upcoming + quick list */}
        <div className="grid grid-cols-12 gap-4 mb-5">
          <div className="col-span-12 lg:col-span-7 rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-sm">
                  ⚡
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">Ближайшие платежи</h3>
                  <span className="text-xs text-neutral-500">Неоплаченные по сроку</span>
                </div>
              </div>
              <Link href="/calendar" className="text-xs text-blue-400 hover:underline">
                Календарь →
              </Link>
            </div>
            <div className="space-y-2">
              {loading && (
                <div className="py-8 text-center text-sm text-neutral-500">Загрузка…</div>
              )}
              {!loading && stats.upcoming.length === 0 && (
                <div className="py-8 text-center text-sm text-neutral-500">
                  Нет ближайших неоплаченных
                </div>
              )}
              {stats.upcoming.map((x) => (
                <div
                  key={x.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] px-3 py-2.5 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {x.name || `Платёж #${x.id}`}
                    </div>
                    <div className="text-[11px] text-neutral-500">{fmtDate(x.due_date)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold font-mono">
                      {fmtMoney(x.amount, x.currency || "RUB")}
                    </span>
                    <button
                      type="button"
                      disabled={payingId === x.id}
                      onClick={() => void markPaid(x.id)}
                      className="h-8 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      {payingId === x.id ? "…" : "Оплачено"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Просроченные</h3>
                <span className="text-xs text-neutral-500">Требуют внимания</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[11px] font-bold">
                {stats.overdue.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {stats.overdue.length === 0 && (
                <div className="py-10 text-center text-sm text-neutral-500">
                  Просрочек нет ✓
                </div>
              )}
              {stats.overdue.slice(0, 8).map((x) => (
                <div
                  key={x.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/15 bg-rose-500/[0.04] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {x.name || `#${x.id}`}
                    </div>
                    <div className="text-[11px] text-rose-400/80">{fmtDate(x.due_date)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold font-mono">
                      {fmtMoney(x.amount, x.currency || "RUB")}
                    </div>
                    <button
                      type="button"
                      disabled={payingId === x.id}
                      onClick={() => void markPaid(x.id)}
                      className="text-[11px] text-emerald-400 hover:underline disabled:opacity-50"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Operations table */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Операции и счета</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-[12px] font-bold">
                  {stats.total}
                </span>
              </div>
              <span className="text-xs text-neutral-500">
                Выписка по обязательствам за текущий период
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ["all", "Все"],
                  ["unpaid", "К оплате"],
                  ["overdue", "Просрочка"],
                  ["paid", "Оплачено"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors",
                    filter === k
                      ? "bg-white text-black"
                      : "bg-white/[0.04] text-neutral-400 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-white/[0.03]">
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500 rounded-l-xl">
                    Наименование
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Срок
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Валюта
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500 text-right">
                    Сумма
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500 text-center rounded-r-xl">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => (
                  <tr
                    key={x.id}
                    className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center text-neutral-400 shrink-0 text-sm">
                          {x.is_paid ? "✓" : x.is_overdue ? "!" : "·"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {x.name || `Платёж #${x.id}`}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            occurrence · {x.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium">{fmtDate(x.due_date)}</div>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400">
                      {x.currency || "RUB"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold font-mono">
                      <span
                        className={cn(
                          x.is_paid ? "text-emerald-400" : "text-white"
                        )}
                      >
                        {x.is_paid ? "" : "− "}
                        {fmtMoney(x.amount, x.currency || "RUB")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {x.is_paid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold">
                          Исполнен
                        </span>
                      ) : x.is_overdue ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 text-[11px] font-bold">
                          Просрочен
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-bold">
                          Ожидает
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-neutral-500">
                      Нет записей
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] p-3 rounded-xl">
            <span className="text-xs text-neutral-500">
              Показано {filtered.length} из {stats.total}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 uppercase tracking-wider font-bold">
                К оплате (RUB):
              </span>
              <span className="text-sm font-bold font-mono">{fmtMoney(stats.rubUnpaid)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
