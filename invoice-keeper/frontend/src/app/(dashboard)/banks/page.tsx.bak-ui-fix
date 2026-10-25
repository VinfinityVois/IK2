"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Shield,
  Copy,
  ArrowUpRight,
  Download,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Snowflake,
  Globe,
  Landmark,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wallet,
  PiggyBank,
  Check,
  Clock,
  Loader2,
} from "lucide-react";
import {
  getPaymentOccurrences,
  getPaymentsSummary,
  updatePaymentOccurrence,
} from "@/lib/api";

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

const DEMO_ACCOUNTS = [
  {
    id: "tbank",
    name: "Т-Банк Корпоративный B2B",
    type: "Основной",
    typeBadge: "primary" as const,
    mark: "Т",
    markBg: "bg-gradient-to-tr from-amber-400 to-yellow-300 text-[#191c1e]",
    account: "•••• 8291",
    bik: "044525974",
    amount: 4_850_000,
    currency: "RUB",
    status: "Демо-остаток",
    note: "Демо-данные. Не участвует в расчётах платежей.",
    actions: ["Реквизиты", "Выписка"],
  },
  {
    id: "alfa",
    name: "Альфа-Банк Корпоративный",
    type: "Зарплатный (ФОТ)",
    typeBadge: "secondary" as const,
    mark: "А",
    markBg: "bg-[#ef3124] text-white",
    account: "•••• 2901",
    bik: "044525593",
    amount: 1_820_450,
    currency: "RUB",
    status: "Демо-остаток",
    note: "Демо-данные. Open Banking не подключён.",
    actions: ["Ведомость ФОТ", "Реквизиты"],
  },
];

const DEMO_SECONDARY = [
  {
    id: "gpb",
    name: "ВЭД Счета (USD / CNY)",
    mark: "ГПБ",
    markBg: "bg-[#00468c] text-white text-[11px] font-bold",
    account: "•••• 4120",
    badge: "ВЭД",
    primary: { value: "$18 450.00", rub: "~1 704 780 ₽" },
    secondary: { value: "¥ 120 000.00", rub: "~1 524 000 ₽" },
    footer: "Демо · валютный контроль",
    action: "Конверсия",
  },
  {
    id: "overnight",
    name: "Сейф-Овернайт",
    mark: null as string | null,
    markIcon: "savings" as const,
    markBg: "bg-emerald-600/30 text-emerald-300",
    account: "14.5% годовых",
    badge: "Ежедневно",
    badgeAccent: true,
    primary: { value: "540 000.00 ₽", rub: null as string | null },
    secondary: { value: "Демо-накопительный счёт", rub: null as string | null },
    footer: "Авто-свип · демо",
    action: "Управление",
  },
];

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

const formatRequisites = (acc: (typeof DEMO_ACCOUNTS)[0]) =>
  `${acc.name}\nР/с ${acc.account}\nБИК ${acc.bik}\n(демо-реквизиты)`;

export default function BanksPage() {
  const [items, setItems] = useState<Occurrence[]>([]);
  const [summary, setSummary] = useState<CurrencySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);

  const [cardIndex, setCardIndex] = useState(0);
  const [freeze, setFreeze] = useState(false);
  const [onlineTx, setOnlineTx] = useState(true);
  const [atm, setAtm] = useState(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
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
      showToast("Не удалось загрузить данные платежей");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const unpaid = items.filter((x) => !x.is_paid);
    const late = unpaid.filter((x) => x.is_overdue);
    const recent = [...items]
      .sort((a, b) => (a.due_date < b.due_date ? 1 : -1))
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

    return {
      unpaid,
      late,
      recent,
      byCur,
      rubUnpaid: byCur.RUB?.unpaid ?? 0,
      rubOverdue: byCur.RUB?.overdue ?? 0,
      totalUnpaidCount: unpaid.length,
      totalLateCount: late.length,
    };
  }, [items, summary]);

  const demoTotalRub = DEMO_ACCOUNTS.reduce((s, a) => s + a.amount, 0) + 540_000;

  const markPaid = async (id: number) => {
    setPayingId(id);
    try {
      await updatePaymentOccurrence(id, { is_paid: true });
      showToast("Платёж отмечен оплаченным");
      await load();
    } catch (e) {
      console.error(e);
      showToast("Ошибка при обновлении статуса");
    } finally {
      setPayingId(null);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} скопированы`);
    } catch {
      showToast("Не удалось скопировать");
    }
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Банки и счета
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Демо-остатки + живые платежи
            </span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              {loading ? "…" : `${stats.totalUnpaidCount} к оплате`}
            </span>
            {stats.totalLateCount > 0 && (
              <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-rose-300">
                {stats.totalLateCount} просрочено
              </span>
            )}
          </div>
          <p className="max-w-2xl text-sm text-neutral-400 leading-relaxed">
            Остатки банков — демонстрационные и не участвуют в расчётах. Обязательства и
            список платежей загружаются из базы (payment-occurrences).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const lines = [
                "Банки и счета — экспорт",
                `Дата: ${new Date().toLocaleString("ru-RU")}`,
                "",
                "=== Демо-счета ===",
                ...DEMO_ACCOUNTS.map(
                  (a) => `${a.name}: ${fmtMoney(a.amount, a.currency)} (${a.account})`
                ),
                "",
                "=== К оплате (БД) ===",
                ...stats.unpaid.map(
                  (x) =>
                    `${x.name || "Платёж"} | ${fmtMoney(x.amount, x.currency || "RUB")} | до ${fmtDate(x.due_date)}${x.is_overdue ? " | ПРОСРОЧЕН" : ""}`
                ),
              ];
              const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `banks-export-${new Date().toISOString().slice(0, 10)}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              showToast("Экспорт скачан");
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
          >
            <Download className="h-4 w-4 text-neutral-400" />
            Экспорт
          </button>
          <button
            type="button"
            onClick={() => setNotice(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
          >
            <Landmark className="h-4 w-4 text-rose-400" />
            + Подключить банк
          </button>
          <button
            type="button"
            onClick={() => showToast("Выпуск карт будет доступен после Open Banking")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(225,29,72,0.35)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <CreditCard className="h-4 w-4" />
            Выпустить карту
          </button>
        </div>
      </header>

      {notice && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.07] p-4">
          <div>
            <p className="text-sm font-medium text-white">Open Banking ещё не подключён</p>
            <p className="mt-1 text-xs text-neutral-400">
              Реальные банковские счета и карты появятся после интеграции. Сейчас отображаются
              демо-остатки; платежи и обязательства — из вашей БД.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotice(false)}
            className="shrink-0 text-xs text-neutral-300 hover:text-white"
          >
            Закрыть
          </button>
        </div>
      )}

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-[#1c0407] via-[#2f080e] to-[#0e0204] p-5 min-h-[150px] flex flex-col justify-between">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-rose-500/25 blur-2xl" />
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-200/80">
              Демо · суммарный капитал
            </span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              Не из API
            </span>
          </div>
          <div className="relative z-10 mt-2">
            <p className="text-2xl font-bold tracking-tight text-white leading-none">
              {fmtMoney(demoTotalRub, "RUB")}
            </p>
            <p className="mt-2 text-[11px] text-neutral-400">
              Т-Банк + Альфа + Овернайт (демо)
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 min-h-[150px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              К оплате (из БД)
            </span>
            <Wallet className="h-4 w-4 text-neutral-400" />
          </div>
          <div>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
            ) : (
              <>
                <p className="text-2xl font-semibold text-white">
                  {fmtMoney(stats.rubUnpaid, "RUB")}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {stats.totalUnpaidCount} обязательств
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-500">
            {Object.entries(stats.byCur).map(([c, v]) => (
              <span key={c} className="rounded-full bg-white/[0.06] px-2 py-0.5">
                {c}: {fmtMoney(v.unpaid, c)}
              </span>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 min-h-[150px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Просрочено (из БД)
            </span>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
            ) : (
              <>
                <p className="text-2xl font-semibold text-rose-300">
                  {fmtMoney(stats.rubOverdue, "RUB")}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {stats.totalLateCount} записей payment-occurrences
                </p>
              </>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 min-h-[150px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Статус интеграции
            </span>
            <Shield className="h-4 w-4 text-neutral-400" />
          </div>
          <div>
            <p className="text-xl font-semibold text-amber-200">Демо-режим</p>
            <p className="mt-1 text-xs text-neutral-500">Open Banking — не подключён</p>
          </div>
          <button
            type="button"
            onClick={() => setNotice(true)}
            className="self-start rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.1]"
          >
            Подробнее
          </button>
        </article>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Расчётные счета</h2>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-neutral-400">
                {DEMO_ACCOUNTS.length + DEMO_SECONDARY.length}
              </span>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/[.07] px-2 py-0.5 text-[10px] uppercase text-amber-200">
                Demo
              </span>
            </div>
            <button
              type="button"
              onClick={() => showToast("Приоритеты счетов — после Open Banking")}
              className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 hover:underline"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Настроить
            </button>
          </div>

          {DEMO_ACCOUNTS.map((acc) => (
            <article
              key={acc.id}
              className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 transition hover:border-white/[0.12]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold shadow-sm ${acc.markBg}`}
                  >
                    {acc.mark}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-white">{acc.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          acc.typeBadge === "primary"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-white/[0.06] text-neutral-400"
                        }`}
                      >
                        {acc.type}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
                      <span>Р/с {acc.account}</span>
                      <span>•</span>
                      <span>БИК {acc.bik}</span>
                      <button
                        type="button"
                        title="Скопировать реквизиты"
                        onClick={() => void copyText(formatRequisites(acc), "Реквизиты")}
                        className="inline-flex items-center text-neutral-500 hover:text-neutral-300"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-xl font-semibold tabular-nums text-white leading-tight">
                    {fmtMoney(acc.amount, acc.currency)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{acc.status}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 rounded-xl bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <CheckCircle2 className="h-4 w-4 text-amber-400/80" />
                  <span>{acc.note}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {acc.actions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => {
                        if (action === "Реквизиты" || action === "Ведомость ФОТ") {
                          void copyText(formatRequisites(acc), action);
                        } else {
                          showToast(`${action}: доступно после Open Banking`);
                        }
                      }}
                      className="rounded-full bg-[#1a1a1a] px-3 py-1 text-[11px] font-medium text-neutral-200 transition hover:bg-white/[0.08]"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {DEMO_SECONDARY.map((card) => (
              <article
                key={card.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-[#111] p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.markBg}`}
                    >
                      {card.markIcon === "savings" ? (
                        <PiggyBank className="h-5 w-5" />
                      ) : (
                        <span className="text-[11px] font-bold leading-none">{card.mark}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold leading-snug text-white">{card.name}</p>
                      <p className="text-[11px] text-neutral-500">{card.account}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      card.badgeAccent
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/[0.08] text-neutral-300"
                    }`}
                  >
                    {card.badge}
                  </span>
                </div>
                <div className="my-4 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-xl font-semibold ${
                        card.id === "overnight" ? "text-emerald-400" : "text-white"
                      }`}
                    >
                      {card.primary.value}
                    </span>
                    {card.primary.rub && (
                      <span className="text-xs text-neutral-500">{card.primary.rub}</span>
                    )}
                  </div>
                  {card.secondary && (
                    <p className="text-sm text-neutral-400">{card.secondary.value}</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {card.footer}
                  </span>
                  <button
                    type="button"
                    onClick={() => showToast(`${card.action}: демо-режим`)}
                    className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-neutral-200 transition hover:bg-white/[0.1]"
                  >
                    {card.action}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <article className="mt-2 rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Обязательства из БД</h3>
                <span className="h-2 w-2 rounded-full bg-rose-500" />
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="text-xs font-medium text-rose-400 hover:underline"
              >
                Обновить
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Загрузка платежей…</span>
              </div>
            ) : stats.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                Нет записей payment-occurrences
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {stats.recent.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          tx.is_paid
                            ? "bg-emerald-500/15 text-emerald-400"
                            : tx.is_overdue
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-white/[0.06] text-neutral-300"
                        }`}
                      >
                        {tx.is_paid ? (
                          <Check className="h-5 w-5" />
                        ) : tx.is_overdue ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {tx.name || `Платёж #${tx.id}`}
                        </p>
                        <p className="truncate text-[11px] text-neutral-500">
                          До {fmtDate(tx.due_date)}
                          {tx.is_paid && tx.paid_at ? ` · оплачен ${fmtDate(tx.paid_at)}` : ""}
                          {tx.is_overdue && !tx.is_paid ? " · просрочен" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-[13px] font-semibold tabular-nums text-white">
                          {fmtMoney(tx.amount, tx.currency || "RUB")}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                          {tx.currency || "RUB"}
                        </p>
                      </div>
                      {!tx.is_paid && (
                        <button
                          type="button"
                          disabled={payingId === tx.id}
                          onClick={() => void markPaid(tx.id)}
                          className="rounded-full bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {payingId === tx.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Оплачено"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <div className="xl:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-lg font-semibold text-white">Витрина карт</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-neutral-300 transition hover:bg-white/[0.1]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {cardIndex + 1} из 3
              </span>
              <button
                type="button"
                onClick={() => setCardIndex((i) => Math.min(2, i + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-neutral-300 transition hover:bg-white/[0.1]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative flex flex-col items-center">
            <div className="relative z-30 w-full overflow-hidden rounded-2xl bg-gradient-to-tr from-[#111315] via-[#1a1d20] to-[#262a2e] p-6 text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.45)]">
              <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-rose-500/20 blur-3xl" />
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-sm font-bold text-white">
                    A
                  </div>
                  <span className="text-base font-bold tracking-tight">AuraPay Signature</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
                  <span className={`h-2 w-2 rounded-full ${freeze ? "bg-sky-300" : "bg-emerald-400"}`} />
                  <span className="text-[10px] font-semibold uppercase text-white">
                    {freeze ? "Заморожена" : "Активна"}
                  </span>
                </div>
              </div>
              <div className="relative z-10 my-5 flex items-center gap-3">
                <div className="flex h-8 w-11 items-center justify-center rounded bg-gradient-to-br from-amber-300 to-amber-600 opacity-90">
                  <div className="h-5 w-7 rounded-sm bg-black/20" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Доступный остаток (демо)
                </p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight">
                  1 240 500
                  <span className="text-base font-semibold text-white/50">.00 ₽</span>
                </p>
              </div>
              <div className="relative z-10 mt-6 flex items-end justify-between border-t border-white/10 pt-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Держатель</p>
                  <p className="text-xs font-semibold text-white">DEMO USER</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Срок</p>
                  <p className="text-xs font-medium tabular-nums text-white">08/29</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold tracking-widest text-white">•••• 8967</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                    VISA CORPORATE
                  </p>
                </div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              className="relative z-20 -mt-5 w-[94%] cursor-pointer rounded-2xl bg-gradient-to-r from-[#004e38] to-[#008f5d] px-4 py-3 text-white shadow-lg transition hover:-translate-y-1"
              onClick={() => showToast("Virtual Cloud & Dev — демо-карта")}
              onKeyDown={(e) => e.key === "Enter" && showToast("Virtual Cloud & Dev — демо-карта")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-200 text-sm">{"</>"}</span>
                  <div>
                    <p className="text-sm font-medium">Virtual Cloud &amp; Dev</p>
                    <p className="text-[11px] text-white/70">•••• 4412 · демо</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-200">$2,480</span>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="relative z-10 -mt-3 w-[88%] cursor-pointer rounded-2xl bg-gradient-to-r from-[#2c124d] to-[#51238f] px-4 py-3 text-white shadow-lg transition hover:-translate-y-1"
              onClick={() => showToast("Travel VIP — демо-карта")}
              onKeyDown={(e) => e.key === "Enter" && showToast("Travel VIP — демо-карта")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-white/80" />
                  <div>
                    <p className="text-sm font-medium">Travel &amp; Hospitality VIP</p>
                    <p className="text-[11px] text-white/70">•••• 1092 · демо</p>
                  </div>
                </div>
                <span className="text-sm font-bold">350 000 ₽</span>
              </div>
            </div>
          </div>

          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-white">Управление картой Signature</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Демо-UI
              </span>
            </div>

            <div className="mb-4 flex items-center gap-4 rounded-xl bg-white/[0.03] p-4">
              <div className="relative flex h-16 w-24 items-center justify-center">
                <svg className="h-16 w-24 overflow-visible" viewBox="0 0 100 60">
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeLinecap="round"
                    strokeWidth="8"
                  />
                  <path
                    d="M 10 50 A 40 40 0 0 1 76 22"
                    fill="none"
                    stroke="#e11d48"
                    strokeDasharray="125"
                    strokeDashoffset="35"
                    strokeLinecap="round"
                    strokeWidth="8"
                  />
                </svg>
                <div className="absolute bottom-0 flex flex-col items-center">
                  <span className="text-base font-bold leading-none text-white">74%</span>
                  <span className="text-[9px] uppercase text-neutral-500">лимита</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Месячный расход: 1.11M ₽</p>
                <p className="mt-0.5 text-xs leading-snug text-neutral-500">
                  Демо-метрика. Реальные лимиты карт появятся после Open Banking.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              {[
                {
                  key: "freeze",
                  icon: Snowflake,
                  title: "Заморозить карту",
                  desc: "Локальный переключатель (демо)",
                  checked: freeze,
                  onChange: (v: boolean) => {
                    setFreeze(v);
                    showToast(v ? "Карта заморожена (демо)" : "Карта разморожена (демо)");
                  },
                  onColor: "bg-rose-500",
                },
                {
                  key: "online",
                  icon: Globe,
                  title: "Интернет-покупки",
                  desc: "3D-Secure · демо",
                  checked: onlineTx,
                  onChange: (v: boolean) => {
                    setOnlineTx(v);
                    showToast(v ? "Интернет-покупки включены" : "Интернет-покупки выключены");
                  },
                  onColor: "bg-emerald-500",
                },
                {
                  key: "atm",
                  icon: Landmark,
                  title: "Снятие в банкоматах",
                  desc: "Лимит 100 000 ₽ / сутки · демо",
                  checked: atm,
                  onChange: (v: boolean) => {
                    setAtm(v);
                    showToast(v ? "Снятие в банкоматах включено" : "Снятие выключено");
                  },
                  onColor: "bg-emerald-500",
                },
              ].map((t) => (
                <div
                  key={t.key}
                  className="flex items-center justify-between rounded-xl px-2 py-2.5 transition hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-neutral-400">
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{t.title}</p>
                      <p className="text-[11px] text-neutral-500">{t.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.checked}
                    onClick={() => t.onChange(!t.checked)}
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                      t.checked ? t.onColor : "bg-white/[0.12]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        t.checked ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => showToast("PIN/CVV недоступны в демо-режиме")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] py-2.5 text-xs font-medium text-neutral-200 transition hover:bg-white/[0.09]"
              >
                <Eye className="h-4 w-4 text-neutral-400" />
                Показать PIN/CVV
              </button>
              <button
                type="button"
                onClick={() => showToast("Перевыпуск — после Open Banking")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] py-2.5 text-xs font-medium text-neutral-200 transition hover:bg-white/[0.09]"
              >
                <RefreshCw className="h-4 w-4 text-neutral-400" />
                Перевыпустить
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <p className="text-sm font-medium text-white">Как устроена страница</p>
                <ul className="mt-1 space-y-1 text-xs leading-relaxed text-neutral-400 list-disc pl-3.5">
                  <li>
                    <strong className="text-neutral-300">Счета и карты</strong> — демо-контент, не из БД.
                  </li>
                  <li>
                    <strong className="text-neutral-300">К оплате / просрочено / список</strong> —
                    реальные payment-occurrences.
                  </li>
                  <li>
                    Кнопка <strong className="text-neutral-300">Оплачено</strong> вызывает PATCH
                    /payment-occurrences/:id.
                  </li>
                </ul>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}