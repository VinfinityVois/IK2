"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Lock,
  Pencil,
  Shield,
  TrendingUp,
  Wallet,
  BarChart3,
  Gauge,
  Receipt,
  Server,
  Megaphone,
  Building2,
  Plane,
  Banknote,
  RefreshCw,
} from "lucide-react";
import {
  getPaymentOccurrences,
  getPaymentsSummary,
  updatePaymentOccurrence,
} from "@/lib/api";

type Occurrence = {
  id: number;
  recurring_payment_id?: number;
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

type Period = 7 | 30 | 90;

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
    });
  } catch {
    return iso;
  }
};

const parseDue = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

/** Heuristic category from payment name (for breakdown UI) */
function categorize(name: string | null | undefined): string {
  const n = (name || "").toLowerCase();
  if (/аренд|office|офис|rent/.test(n)) return "Аренда";
  if (/vps|server|host|cloud|aws|hetzner|timeweb|figma|saas|подписк/.test(n))
    return "IT & Cloud";
  if (/зарплат|фот|salary|payroll|ндфл/.test(n)) return "ФОТ";
  if (/налог|енс|фнс|tax/.test(n)) return "Налоги";
  if (/travel|flight|авиа|команд/.test(n)) return "Командировки";
  return "Прочее";
}

const CATEGORY_COLORS: Record<string, string> = {
  ФОТ: "bg-rose-500",
  "IT & Cloud": "bg-neutral-200",
  Налоги: "bg-emerald-500",
  Аренда: "bg-orange-500",
  Командировки: "bg-violet-500",
  Прочее: "bg-neutral-500",
};

/** Demo department limits — not in DB */
const DEMO_LIMITS = [
  {
    id: "it",
    name: "IT & Инфраструктура",
    owner: "По платежам IT/Cloud",
    icon: Server,
    spent: 0,
    limit: 1_500_000,
    demo: true,
  },
  {
    id: "mkt",
    name: "Маркетинг & Трафик",
    owner: "Демо-лимит отдела",
    icon: Megaphone,
    spent: 0,
    limit: 2_000_000,
    demo: true,
    warn: true,
  },
  {
    id: "admin",
    name: "Административные & Аренда",
    owner: "Аренда и офис",
    icon: Building2,
    spent: 0,
    limit: 800_000,
    demo: true,
  },
  {
    id: "travel",
    name: "Командировки",
    owner: "Travel-категория",
    icon: Plane,
    spent: 0,
    limit: 600_000,
    demo: true,
  },
  {
    id: "cash",
    name: "Снятие наличных",
    owner: "Жёсткий лимит · демо 115-ФЗ",
    icon: Banknote,
    spent: 0,
    limit: 300_000,
    demo: true,
  },
];

export default function ForecastPage() {
  const [items, setItems] = useState<Occurrence[]>([]);
  const [summary, setSummary] = useState<CurrencySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<Period>(30);
  const [chartTab, setChartTab] = useState<"flow" | "cats" | "list">("flow");
  const [toast, setToast] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [autoStop, setAutoStop] = useState(true);
  const [alert80, setAlert80] = useState(true);

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
      showToast("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const analytics = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const unpaid = items.filter((x) => !x.is_paid);
    const overdue = unpaid.filter((x) => x.is_overdue);
    const upcoming = unpaid.filter((x) => {
      const d = parseDue(x.due_date);
      return d >= start && d < end;
    });
    const paid = items.filter((x) => x.is_paid);

    const byCurrencyUpcoming: Record<string, number> = {};
    for (const x of upcoming) {
      const c = x.currency || "RUB";
      byCurrencyUpcoming[c] = (byCurrencyUpcoming[c] || 0) + num(x.amount);
    }

    const byCurrencyAllUnpaid: Record<string, number> = {};
    for (const x of unpaid) {
      const c = x.currency || "RUB";
      byCurrencyAllUnpaid[c] = (byCurrencyAllUnpaid[c] || 0) + num(x.amount);
    }

    // bars
    const n = days === 7 ? 7 : days === 30 ? 6 : 9;
    const step = days / n;
    const bars = Array.from({ length: n }, () => ({
      label: "",
      amount: 0,
      count: 0,
    }));
    upcoming.forEach((x) => {
      const d = parseDue(x.due_date);
      const offset = Math.max(0, Math.floor((d.getTime() - start.getTime()) / 86400000));
      const idx = Math.min(n - 1, Math.floor(offset / step));
      bars[idx].amount += num(x.amount);
      bars[idx].count += 1;
    });
    bars.forEach((b, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + Math.floor(i * step));
      b.label = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
      }).format(d);
    });
    const maxBar = Math.max(...bars.map((b) => b.amount), 1);

    // category breakdown on all items (paid+unpaid) for structure
    const catMap: Record<string, number> = {};
    for (const x of items) {
      const cat = categorize(x.name);
      catMap[cat] = (catMap[cat] || 0) + num(x.amount);
    }
    const catTotal = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
    const categories = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: (amount / catTotal) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    // map demo limits spent from categories (approximate)
    const limits = DEMO_LIMITS.map((L) => {
      let spent = 0;
      if (L.id === "it") spent = catMap["IT & Cloud"] || 0;
      else if (L.id === "admin") spent = catMap["Аренда"] || 0;
      else if (L.id === "travel") spent = catMap["Командировки"] || 0;
      else if (L.id === "mkt") spent = Math.round((catMap["Прочее"] || 0) * 0.4);
      else if (L.id === "cash") spent = Math.round((catMap["Прочее"] || 0) * 0.05);
      const pct = L.limit > 0 ? (spent / L.limit) * 100 : 0;
      return { ...L, spent, pct };
    });

    const rubUpcoming = byCurrencyUpcoming.RUB || 0;
    const rubOverdue = overdue
      .filter((x) => (x.currency || "RUB") === "RUB")
      .reduce((s, x) => s + num(x.amount), 0);

    // summary totals
    let summaryUnpaid = 0;
    let summaryOverdue = 0;
    let summaryPaid = 0;
    for (const s of summary) {
      if (s.currency === "RUB") {
        summaryUnpaid += num(s.unpaid_amount);
        summaryOverdue += num(s.overdue_amount);
        summaryPaid += num(s.paid_amount);
      }
    }
    if (summary.length === 0) {
      summaryUnpaid = byCurrencyAllUnpaid.RUB || 0;
      summaryOverdue = rubOverdue;
      summaryPaid = paid
        .filter((x) => (x.currency || "RUB") === "RUB")
        .reduce((s, x) => s + num(x.amount), 0);
    }

    const planDemo = Math.max(summaryUnpaid + summaryPaid, 100_000);
    const factPct = planDemo > 0 ? Math.min(100, ((summaryPaid + summaryUnpaid) / planDemo) * 100) : 0;

    return {
      unpaid,
      overdue,
      upcoming,
      paid,
      bars,
      maxBar,
      byCurrencyUpcoming,
      byCurrencyAllUnpaid,
      categories,
      limits,
      rubUpcoming,
      rubOverdue,
      summaryUnpaid,
      summaryOverdue,
      summaryPaid,
      planDemo,
      factPct,
    };
  }, [items, days, summary]);

  const markPaid = async (id: number) => {
    setPayingId(id);
    try {
      await updatePaymentOccurrence(id, { is_paid: true });
      showToast("Платёж отмечен оплаченным");
      await load();
    } catch (e) {
      console.error(e);
      showToast("Ошибка при обновлении");
    } finally {
      setPayingId(null);
    }
  };

  const exportReport = () => {
    const lines = [
      "Аналитика и прогноз обязательств",
      `Период: ${days} дней · ${new Date().toLocaleString("ru-RU")}`,
      "",
      "=== К оплате в периоде ===",
      ...analytics.upcoming.map(
        (x) =>
          `${x.name || "Платёж"} | ${fmtMoney(x.amount, x.currency || "RUB")} | ${fmtDate(x.due_date)}${x.is_overdue ? " | ПРОСРОЧЕН" : ""}`
      ),
      "",
      "=== По валютам (период) ===",
      ...Object.entries(analytics.byCurrencyUpcoming).map(
        ([c, n]) => `${c}: ${fmtMoney(n, c)}`
      ),
      "",
      "=== Просрочено ===",
      ...analytics.overdue.map(
        (x) => `${x.name || "Платёж"} | ${fmtMoney(x.amount, x.currency || "RUB")} | ${fmtDate(x.due_date)}`
      ),
      "",
      "Примечание: лимиты отделов — демо. Расчёт обязательств — из payment-occurrences.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast-${days}d-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Отчёт скачан");
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Аналитика &amp; прогноз
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              По данным БД
            </span>
          </div>
          <p className="max-w-2xl text-sm text-neutral-400 leading-relaxed">
            Прогноз обязательств по срокам и суммам из payment-occurrences. Лимиты отделов —
            демонстрационные; банковский остаток не прогнозируется.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-white/[0.08] bg-[#111] p-1">
            {([7, 30, 90] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  days === n
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {n === 7 ? "7Д" : n === 30 ? "30Д" : "90Д"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
          >
            <Download className="h-4 w-4 text-neutral-400" />
            Отчёт
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
          >
            <RefreshCw className={`h-4 w-4 text-neutral-400 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </button>
          <button
            type="button"
            onClick={() => showToast("Установка лимитов отделов — после расширения модели данных")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(225,29,72,0.35)] transition hover:brightness-110"
          >
            <Gauge className="h-4 w-4" />
            Установить лимит
          </button>
        </div>
      </header>

      {/* KPI row */}
      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 flex flex-col justify-between min-h-[150px] gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Обязательства в периоде
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {loading ? "…" : fmtMoney(analytics.rubUpcoming, "RUB")}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-neutral-500">
              <span>{days} дней · из БД</span>
              <span className="font-semibold text-rose-400">
                {analytics.upcoming.length} шт.
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-rose-500"
                style={{
                  width: `${Math.min(100, analytics.upcoming.length * 12)}%`,
                }}
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 flex flex-col justify-between min-h-[150px] gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Всего к оплате (RUB)
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">
                {loading ? "…" : fmtMoney(analytics.summaryUnpaid, "RUB")}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-500">
            {Object.entries(analytics.byCurrencyAllUnpaid).map(([c, v]) => (
              <span key={c} className="rounded-full bg-white/[0.06] px-2 py-0.5">
                {c}: {fmtMoney(v, c)}
              </span>
            ))}
            {Object.keys(analytics.byCurrencyAllUnpaid).length === 0 && (
              <span className="text-neutral-600">Нет неоплаченных</span>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 flex flex-col justify-between min-h-[150px] gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Просрочено
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-rose-300">
                  {loading ? "…" : analytics.overdue.length}
                </p>
                <span className="text-xs text-neutral-500">
                  {fmtMoney(analytics.rubOverdue, "RUB")}
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-neutral-300">
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {analytics.overdue.length === 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Нет просрочек</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-rose-400" />
                <span className="text-rose-300 font-medium">Требуется внимание</span>
              </>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 flex flex-col justify-between min-h-[150px] gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Кассовый разрыв
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                Не оценивается
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-neutral-400">
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Без банковских остатков нельзя подтвердить отсутствие разрыва. Только обязательства по БД.
          </p>
        </article>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Chart card */}
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Динамика обязательств
                </h2>
                <p className="text-xs text-neutral-500">
                  Суммы неоплаченных платежей по срокам в выбранном окне
                </p>
              </div>
              <div className="flex items-center rounded-full bg-white/[0.04] p-1 self-start">
                {(
                  [
                    ["flow", "По срокам"],
                    ["cats", "Категории"],
                    ["list", "Список"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setChartTab(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      chartTab === id
                        ? "bg-[#1a1a1a] text-white shadow"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Загрузка…
              </div>
            ) : chartTab === "flow" ? (
              <>
                <div className="flex h-56 items-end gap-2 sm:gap-3 px-1">
                  {analytics.bars.map((b, i) => (
                    <div
                      key={i}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <span className="text-[9px] text-neutral-500 tabular-nums">
                        {b.amount > 0 ? fmtMoney(b.amount, "RUB").replace(/\s*₽/, "") : ""}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          title={`${b.label}: ${fmtMoney(b.amount, "RUB")} (${b.count})`}
                          className="w-full rounded-t-lg bg-gradient-to-t from-rose-700 to-rose-400 transition-all duration-500 hover:brightness-110"
                          style={{
                            height: `${b.amount ? Math.max(6, (b.amount / analytics.maxBar) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="truncate text-[10px] text-neutral-500">{b.label}</span>
                      <span className="text-[9px] text-neutral-600">{b.count || ""}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-neutral-500">
                  Высота столбца — сумма обязательств; число под датой — количество платежей.
                </p>
              </>
            ) : chartTab === "cats" ? (
              <div className="space-y-3 py-2">
                {analytics.categories.length === 0 ? (
                  <p className="text-sm text-neutral-500 py-8 text-center">Нет данных</p>
                ) : (
                  analytics.categories.map((c) => (
                    <div key={c.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-neutral-300">{c.name}</span>
                        <span className="font-semibold text-white tabular-nums">
                          {fmtMoney(c.amount, "RUB")} · {c.pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className={`h-full rounded-full ${CATEGORY_COLORS[c.name] || "bg-neutral-500"}`}
                          style={{ width: `${Math.max(2, c.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
                <p className="text-[11px] text-neutral-500 pt-2">
                  Категории выведены эвристикой по названию платежа (не справочник БД).
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                {analytics.upcoming.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    Нет обязательств в выбранном периоде
                  </p>
                ) : (
                  analytics.upcoming
                    .slice()
                    .sort((a, b) => a.due_date.localeCompare(b.due_date))
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.03]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              tx.is_overdue
                                ? "bg-rose-500/15 text-rose-400"
                                : "bg-white/[0.06] text-neutral-300"
                            }`}
                          >
                            {tx.is_overdue ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {tx.name || `Платёж #${tx.id}`}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              {fmtDate(tx.due_date)} · {categorize(tx.name)}
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
                    ))
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1a1a] text-rose-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Средняя сумма
                  </p>
                  <p className="text-sm font-bold text-white">
                    {analytics.upcoming.length
                      ? fmtMoney(
                          analytics.rubUpcoming / analytics.upcoming.length,
                          "RUB"
                        )
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1a1a] text-neutral-300">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Ближайший срок
                  </p>
                  <p className="text-sm font-bold text-white">
                    {analytics.upcoming.length
                      ? fmtDate(
                          [...analytics.upcoming].sort((a, b) =>
                            a.due_date.localeCompare(b.due_date)
                          )[0].due_date
                        )
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1a1a] text-emerald-400">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Оплачено (RUB, всё время)
                  </p>
                  <p className="text-sm font-bold text-emerald-400">
                    {fmtMoney(analytics.summaryPaid, "RUB")}
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Limits matrix — demo filled with category spend */}
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">
                    Матрица лимитов (демо)
                  </h2>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-neutral-400">
                    {analytics.limits.length} отделов
                  </span>
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/[.07] px-2 py-0.5 text-[10px] uppercase text-amber-200">
                    Demo
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Лимиты не хранятся в БД. «Расход» приближённо из категорий платежей.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {analytics.limits.map((row) => {
                const Icon = row.icon;
                const warn = row.pct >= 90;
                const ok = row.pct < 75;
                return (
                  <div
                    key={row.id}
                    className={`flex flex-col gap-3 rounded-xl p-4 transition md:flex-row md:items-center md:justify-between ${
                      warn
                        ? "bg-rose-500/10 border border-rose-500/20"
                        : "bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a1a] text-neutral-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{row.name}</p>
                        <p className="text-[11px] text-neutral-500">{row.owner}</p>
                      </div>
                    </div>
                    <div className="flex-1 max-w-xs flex flex-col gap-1">
                      <div className="flex justify-between text-xs tabular-nums">
                        <span className={`font-semibold ${warn ? "text-rose-300" : "text-white"}`}>
                          {fmtMoney(row.spent, "RUB")}
                        </span>
                        <span className="text-neutral-500">
                          из {fmtMoney(row.limit, "RUB")}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className={`h-full rounded-full ${
                            warn ? "bg-rose-500" : ok ? "bg-emerald-500" : "bg-neutral-300"
                          }`}
                          style={{ width: `${Math.min(100, row.pct)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          warn
                            ? "bg-rose-500 text-white"
                            : ok
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white/[0.08] text-neutral-300"
                        }`}
                      >
                        {row.pct.toFixed(1)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => showToast("Редактирование лимита — демо")}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-neutral-400 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast("Заморозка — демо")}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-neutral-400 hover:text-rose-400"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        {/* Right */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Gauge */}
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 flex flex-col items-center text-center">
            <div className="mb-2 flex w-full items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Нагрузка по обязательствам
              </span>
              <Gauge className="h-5 w-5 text-neutral-500" />
            </div>
            <div className="relative mt-2 flex h-36 w-64 items-center justify-center">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 240 140">
                <path
                  d="M 25 125 A 95 95 0 0 1 215 125"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeLinecap="round"
                  strokeWidth="18"
                />
                <path
                  d="M 25 125 A 95 95 0 0 1 215 125"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeDasharray="298.45"
                  strokeDashoffset={String(
                    298.45 * (1 - Math.min(0.95, analytics.upcoming.length / 12))
                  )}
                  strokeLinecap="round"
                  strokeWidth="18"
                />
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="65%" stopColor="#fda4af" />
                    <stop offset="100%" stopColor="#e11d48" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute bottom-1 flex flex-col items-center">
                <span className="text-3xl font-extrabold text-white leading-none">
                  {analytics.upcoming.length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  платежей в окне
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-lg font-extrabold text-white">
                {fmtMoney(analytics.rubUpcoming, "RUB")}
              </span>
              <span className="text-neutral-500 text-sm">/ {days}д</span>
            </div>

            <div className="mt-4 w-full space-y-2 border-t border-white/[0.06] pt-4">
              {[
                {
                  title: "Автостоп при 100%",
                  desc: "Демо-настройка (нет в БД)",
                  checked: autoStop,
                  set: setAutoStop,
                },
                {
                  title: "Алерт при 80% лимита",
                  desc: "Демо-настройка уведомлений",
                  checked: alert80,
                  set: setAlert80,
                },
              ].map((t) => (
                <div
                  key={t.title}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{t.title}</p>
                    <p className="text-[11px] text-neutral-500">{t.desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.checked}
                    onClick={() => {
                      t.set(!t.checked);
                      showToast(`${t.title}: ${!t.checked ? "вкл" : "выкл"} (локально)`);
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      t.checked ? "bg-rose-500" : "bg-white/[0.12]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        t.checked ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </article>

          {/* Top categories */}
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Структура по названиям</h3>
              <span className="text-[10px] font-semibold uppercase text-neutral-500">
                Эвристика
              </span>
            </div>
            {analytics.categories.length > 0 && (
              <div className="mb-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
                {analytics.categories.map((c) => (
                  <div
                    key={c.name}
                    className={`h-full ${CATEGORY_COLORS[c.name] || "bg-neutral-500"}`}
                    style={{ width: `${Math.max(2, c.pct)}%` }}
                    title={`${c.name}: ${c.pct.toFixed(0)}%`}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {analytics.categories.slice(0, 6).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[c.name] || "bg-neutral-500"}`}
                    />
                    <span className="text-neutral-300">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-semibold text-white">
                      {fmtMoney(c.amount, "RUB")}
                    </span>
                    <span className="text-neutral-500 text-xs w-8 text-right">
                      {c.pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
              {analytics.categories.length === 0 && (
                <p className="text-sm text-neutral-500 py-4 text-center">Нет платежей</p>
              )}
            </div>
          </article>

          {/* Interpretation */}
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <h3 className="text-base font-semibold text-white mb-3">Интерпретация</h3>
            <div className="space-y-2.5">
              {analytics.overdue.length > 0 ? (
                <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-3">
                  <p className="text-sm font-medium text-rose-200">Проверьте просрочки</p>
                  <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                    {analytics.overdue.length} платежей просрочены. Отметьте оплату или скорректируйте
                    сроки на дашборде.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-3">
                  <p className="text-sm font-medium text-emerald-200">Нет помеченных просрочек</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Без банковских остатков нельзя подтвердить отсутствие кассового разрыва.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-neutral-200">Следующая итерация</p>
                <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                  После Open Banking — прогноз остатков, сценарии CF и лимиты отделов в БД.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="text-xs text-neutral-400 leading-relaxed">
                <p className="font-medium text-white text-sm mb-1">Данные страницы</p>
                <ul className="list-disc pl-3.5 space-y-1">
                  <li>
                    График, KPI и список —{" "}
                    <code className="text-neutral-300">payment-occurrences</code>
                  </li>
                  <li>
                    Сводки валют —{" "}
                    <code className="text-neutral-300">GET /payments/summary</code>
                  </li>
                  <li>
                    «Оплачено» —{" "}
                    <code className="text-neutral-300">PATCH /payment-occurrences/:id</code>
                  </li>
                  <li>Лимиты отделов и AML-блоки — демо-UI</li>
                </ul>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}