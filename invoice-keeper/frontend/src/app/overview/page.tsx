"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wallet,
  CreditCard,
  BarChart3,
  Settings,
} from "lucide-react";
import {
  getPaymentOccurrences,
  getPaymentsSummary,
  updatePaymentOccurrence,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth";

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

    // next 30 days obligations
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
      .slice(0, 10);

    return {
      unpaid,
      overdue,
      paid,
      upcoming,
      byCur,
      rubUnpaid,
      rubOverdue,
      rubPaid,
      next30,
      next30Sum,
      recent,
      total: items.length,
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

  const name = user?.username || "пользователь";

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Dashboard · данные из БД
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Обзор
          </h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">
            Здравствуйте, {name}. Сводка по обязательствам, просрочкам и ближайшим платежам
            из payment-occurrences.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 hover:bg-white/[0.06]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </header>

      {/* KPI */}
      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-[#1c0407] via-[#2f080e] to-[#0e0204] p-5 min-h-[140px] flex flex-col justify-between">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-500/25 blur-2xl" />
          <p className="relative z-10 text-[10px] font-semibold uppercase tracking-wider text-rose-200/80">
            К оплате (RUB)
          </p>
          <p className="relative z-10 text-2xl font-bold text-white">
            {loading ? "…" : fmtMoney(stats.rubUnpaid, "RUB")}
          </p>
          <p className="relative z-10 text-xs text-neutral-400">
            {stats.unpaid.length} обязательств · из БД
          </p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Просрочено
            </p>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="text-2xl font-semibold text-rose-300">
            {loading ? "…" : stats.overdue.length}
          </p>
          <p className="text-xs text-neutral-500">
            {fmtMoney(stats.rubOverdue, "RUB")} · payment-occurrences
          </p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Ближайшие 30 дней
            </p>
            <Calendar className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-semibold text-white">
            {loading ? "…" : fmtMoney(stats.next30Sum, "RUB")}
          </p>
          <p className="text-xs text-neutral-500">{stats.next30.length} платежей в окне</p>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Оплачено (RUB)
            </p>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-semibold text-emerald-400">
            {loading ? "…" : fmtMoney(stats.rubPaid, "RUB")}
          </p>
          <p className="text-xs text-neutral-500">{stats.paid.length} записей</p>
        </article>
      </section>

      {/* Currency chips */}
      {Object.keys(stats.byCur).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(stats.byCur).map(([c, v]) => (
            <span
              key={c}
              className="rounded-full border border-white/[0.08] bg-[#111] px-3 py-1.5 text-xs text-neutral-300"
            >
              <strong className="text-white">{c}</strong>
              {" · к оплате "}
              {fmtMoney(v.unpaid, c)}
              {v.overdue > 0 && (
                <span className="text-rose-300"> · проср. {fmtMoney(v.overdue, c)}</span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Upcoming */}
        <div className="xl:col-span-7 space-y-4">
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Ближайшие обязательства</h2>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 hover:underline"
              >
                Все платежи <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-12 text-neutral-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Загрузка…
              </div>
            ) : stats.upcoming.length === 0 && stats.overdue.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                Нет неоплаченных обязательств
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {[...stats.overdue, ...stats.upcoming]
                  .filter(
                    (x, i, arr) => arr.findIndex((y) => y.id === x.id) === i
                  )
                  .slice(0, 10)
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            tx.is_overdue
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-white/[0.06] text-neutral-300"
                          }`}
                        >
                          {tx.is_overdue ? (
                            <AlertCircle className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {tx.name || `Платёж #${tx.id}`}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {fmtDate(tx.due_date)}
                            {tx.is_overdue ? " · просрочен" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-white">
                          {fmtMoney(tx.amount, tx.currency || "RUB")}
                        </span>
                        <button
                          type="button"
                          disabled={payingId === tx.id}
                          onClick={() => void markPaid(tx.id)}
                          className="rounded-full bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {payingId === tx.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Оплачено"
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Последние по сроку</h2>
              <span className="text-[10px] uppercase text-neutral-500">
                {stats.total} всего
              </span>
            </div>
            {loading ? null : stats.recent.length === 0 ? (
              <p className="text-sm text-neutral-500">Нет записей</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-white/[0.06]">
                      <th className="pb-2 font-semibold">Название</th>
                      <th className="pb-2 font-semibold">Срок</th>
                      <th className="pb-2 font-semibold text-right">Сумма</th>
                      <th className="pb-2 font-semibold text-center">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/[0.04]">
                        <td className="py-2.5 text-white font-medium">
                          {tx.name || `#${tx.id}`}
                        </td>
                        <td className="py-2.5 text-neutral-400">{fmtDate(tx.due_date)}</td>
                        <td className="py-2.5 text-right tabular-nums text-white">
                          {fmtMoney(tx.amount, tx.currency || "RUB")}
                        </td>
                        <td className="py-2.5 text-center">
                          {tx.is_paid ? (
                            <span className="text-[11px] font-semibold text-emerald-400">
                              Оплачен
                            </span>
                          ) : tx.is_overdue ? (
                            <span className="text-[11px] font-semibold text-rose-400">
                              Просрочен
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-neutral-400">
                              Ожидает
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        {/* Quick links */}
        <div className="xl:col-span-5 space-y-4">
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Разделы</h2>
            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  href: "/dashboard",
                  label: "Платежи",
                  desc: "Список и отметка оплаты",
                  icon: Wallet,
                },
                {
                  href: "/banks",
                  label: "Банки & Счета",
                  desc: "Демо-счета + обязательства",
                  icon: CreditCard,
                },
                {
                  href: "/calendar",
                  label: "Календарь",
                  desc: "Сроки по месяцам",
                  icon: Calendar,
                },
                {
                  href: "/forecast",
                  label: "Прогноз & Анализ",
                  desc: "Окно 7/30/90 дней",
                  icon: BarChart3,
                },
                {
                  href: "/settings",
                  label: "Настройки",
                  desc: "Профиль и пароль",
                  icon: Settings,
                },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition hover:bg-white/[0.05]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-neutral-300">
                    <l.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{l.label}</p>
                    <p className="text-[11px] text-neutral-500">{l.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-neutral-600" />
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Статус данных</h3>
            </div>
            <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>
                Источник: <code className="text-neutral-300">GET /payment-occurrences</code>
              </li>
              <li>
                Сводки: <code className="text-neutral-300">GET /payments/summary</code>
              </li>
              <li>Банковские остатки и курсы ЦБ в макете — не подключены</li>
              <li>Кнопка «Оплачено» пишет в БД через PATCH</li>
            </ul>
          </article>
        </div>
      </div>
    </main>
  );
}