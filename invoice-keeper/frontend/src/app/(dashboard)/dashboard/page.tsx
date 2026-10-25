"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FilePlus2,
  Filter,
  Info,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  getPaymentOccurrences,
  updatePaymentOccurrence,
  deleteRecurringPayment,
  api,
} from "@/lib/api";
import { AddPaymentModal } from "@/components/dashboard/add-payment-modal";
import { PaymentTimeline } from "@/components/dashboard/payment-timeline";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { cn } from "@/lib/utils";

interface Occurrence {
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

type PaymentFilter = "all" | "unpaid" | "overdue" | "paid";
type CurrencyFilter = "all" | "RUB" | "USD" | "EUR";

const CURRENCY_STYLE: Record<string, string> = {
  RUB: "border-white/10 bg-white/[0.06] text-neutral-200",
  USD: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  EUR: "border-violet-400/20 bg-violet-400/10 text-violet-300",
};

const FILTERS: { key: PaymentFilter; label: string; icon: typeof ListFilter }[] = [
  { key: "all", label: "Все платежи", icon: ListFilter },
  { key: "unpaid", label: "Не оплачены", icon: Clock3 },
  { key: "overdue", label: "Просрочены", icon: AlertTriangle },
  { key: "paid", label: "Оплачены", icon: CheckCheck },
];

function CountUp({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) =>
    Math.round(latest).toLocaleString("ru-RU")
  );

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.65, ease: "easeOut" });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span>{rounded}</motion.span>;
}

function HandCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      className={cn(
        "group inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
        checked
          ? "border-rose-400 bg-rose-500/15 text-rose-300"
          : "border-neutral-600 bg-neutral-950 text-transparent hover:border-rose-400/70"
      )}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <motion.path
          d="M4 10.2 8.1 14 16 5.8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </svg>
    </button>
  );
}

function StatusBadge({ item }: { item: Occurrence }) {
  if (item.is_paid) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
        <Check className="h-3 w-3" /> Оплачено
      </span>
    );
  }

  if (item.is_overdue) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[11px] font-medium text-rose-300">
        <AlertTriangle className="h-3 w-3" /> Просрочено
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1 text-[11px] font-medium text-amber-200">
      <Clock3 className="h-3 w-3" /> Ожидает оплаты
    </span>
  );
}

function formatMoney(amount: number | string | null, cur: string | null) {
  if (amount == null) return "—";
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(num)) return "—";
  const supported = ["RUB", "USD", "EUR"];
  const safeCurrency = cur && supported.includes(cur) ? cur : "RUB";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, fetchMe } = useAuthStore();

  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [currency, setCurrency] = useState<CurrencyFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "timeline">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Occurrence | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<Occurrence | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const occData = await getPaymentOccurrences();
      setOccurrences(occData.items || []);
    } catch (error: unknown) {
      console.error("Не удалось загрузить платежи:", error);
      setSuccessMsg("Не удалось загрузить платежи. Проверьте соединение с сервером.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token && !localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    const initialize = async () => {
      try {
        await fetchMe();
        if (!cancelled) await loadData();
      } catch (error: unknown) {
        console.error("Не удалось проверить авторизацию:", error);
        if (!cancelled) router.replace("/login");
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [token, fetchMe, router, loadData]);

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string, undo?: () => void) => {
    setToast({ message, undo });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setSuccessMsg(message);
    window.setTimeout(() => setSuccessMsg(""), 2800);
  }, []);

  const handleTogglePaid = async (item: Occurrence) => {
    setBusyId(item.id);
    try {
      await updatePaymentOccurrence(item.id, {
        is_paid: !item.is_paid,
        paid_at: !item.is_paid ? new Date().toISOString().slice(0, 10) : null,
      });
      showSuccess(item.is_paid ? "Статус оплаты обновлён" : "Платёж отмечен оплаченным");
      await loadData();
    } catch (error: unknown) {
      console.error("Не удалось изменить статус оплаты:", error);
      notify("Не удалось изменить статус. Попробуйте ещё раз.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const item = deleteTarget;
    setDeleteTarget(null);
    setBusyId(item.id);
    try {
      await deleteRecurringPayment(item.recurring_payment_id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      showSuccess("Регулярный платёж деактивирован");
      await loadData();
    } catch (error: unknown) {
      console.error("Не удалось деактивировать платёж:", error);
      notify("Не удалось деактивировать платёж. Попробуйте ещё раз.");
    } finally {
      setBusyId(null);
    }
  };

  const bulkDeactivate = async () => {
    if (selected.size === 0) return;
    setBulkDeleteOpen(false);
    const ids = Array.from(
      new Set(
        occurrences
          .filter((item) => selected.has(item.id))
          .map((item) => item.recurring_payment_id)
      )
    );

    if (ids.length === 0) {
      setSelected(new Set());
      return;
    }

    try {
      await api.post("/recurring-payments/bulk-deactivate", { ids });
      setSelected(new Set());
      showSuccess(`Деактивировано регулярных платежей: ${ids.length}`);
      await loadData();
    } catch (error: unknown) {
      console.error("Не удалось выполнить массовую деактивацию:", error);
      notify("Не удалось выполнить массовую деактивацию.");
    }
  };

  const toggleSelect = (id: number) => {
    const wasSelected = selected.has(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    notify(
      wasSelected ? "Платёж убран из выбранных" : "Платёж добавлен в выбранные",
      () => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (wasSelected) next.add(id);
          else next.delete(id);
          return next;
        });
        setToast(null);
      }
    );
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return occurrences.filter((item) => {
      if (filter === "paid" && !item.is_paid) return false;
      if (filter === "unpaid" && item.is_paid) return false;
      if (filter === "overdue" && !item.is_overdue) return false;
      if (currency !== "all" && item.currency !== currency) return false;
      if (query) {
        const haystack = [item.name || "", item.currency || "", item.due_date || "", item.amount ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [occurrences, filter, currency, search]);

  const stats = useMemo(
    () => ({
      total: occurrences.length,
      unpaid: occurrences.filter((item) => !item.is_paid).length,
      overdue: occurrences.filter((item) => item.is_overdue && !item.is_paid).length,
      paid: occurrences.filter((item) => item.is_paid).length,
    }),
    [occurrences]
  );

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return occurrences
      .filter((item) => !item.is_paid)
      .map((item) => ({
        item,
        date: new Date(`${item.due_date.slice(0, 10)}T12:00:00`),
      }))
      .filter(({ date }) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .find(({ date }) => date.getTime() >= today.getTime())?.item;
  }, [occurrences]);

  const toggleAllVisible = () => {
    const visibleIds = filtered.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
    notify(allSelected ? "Выбор снят" : `Выбрано платежей: ${visibleIds.length}`);
  };

  return (
    <div className="min-h-screen w-full bg-[#08090b] text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#08090b]/85 backdrop-blur-2xl">
        <div className="flex min-h-[76px] flex-wrap items-center gap-4 px-5 py-3 sm:px-7 xl:px-10">
          <div className="min-w-[150px]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,.75)]" />
              Финансовый центр
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">Платежи</h1>
          </div>

          <div className="relative min-w-[180px] flex-1 lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти платёж по названию, сумме или дате…"
              aria-label="Поиск платежей"
              className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-rose-400/40 focus:bg-white/[0.05] focus:ring-4 focus:ring-rose-500/[0.07]"
            />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-neutral-500 md:block">/</kbd>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => setBulkDeleteOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-400/25 px-3 text-xs font-medium text-rose-300 transition hover:bg-rose-400/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Деактивировать ({selected.size})
              </button>
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 text-xs font-semibold text-white shadow-[0_8px_24px_-10px_rgba(244,63,94,.8)] transition hover:brightness-110 active:scale-[.98]"
            >
              <Plus className="h-4 w-4" /> Новый платёж
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1700px] px-4 pb-12 pt-6 sm:px-6 lg:px-8 xl:px-10">
        <WelcomeBanner username={user?.username} role={user?.role} />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-neutral-400">Регулярные обязательства, сроки и история оплаты</p>
            <p className="mt-1 text-xs text-neutral-600">Данные обновляются из вашего Invoice Keeper</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Данные из системы
          </div>
        </div>

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-300"
          >
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="ml-auto rounded-md p-1 text-emerald-200/60 hover:text-white" aria-label="Закрыть уведомление">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Всего платежей", value: stats.total, note: "Все записи", icon: CircleDollarSign, tone: "text-neutral-200", orb: "bg-white/[0.06]" },
            { label: "Ожидают оплаты", value: stats.unpaid, note: "Не отмечены оплаченными", icon: CalendarClock, tone: "text-amber-200", orb: "bg-amber-300/[0.09]" },
            { label: "Просрочены", value: stats.overdue, note: "Требуют внимания", icon: AlertTriangle, tone: "text-rose-300", orb: "bg-rose-400/[0.10]" },
            { label: "Уже оплачены", value: stats.paid, note: "Оплата подтверждена", icon: CheckCheck, tone: "text-emerald-300", orb: "bg-emerald-400/[0.09]" },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
              className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101114] p-5 shadow-[0_14px_36px_-30px_rgba(0,0,0,.9)]"
            >
              <div className={cn("absolute -right-5 -top-8 h-28 w-28 rounded-full blur-2xl", stat.orb)} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-500">{stat.label}</p>
                  <p className={cn("mt-3 text-3xl font-semibold tracking-tight tabular-nums", stat.tone)}>
                    <CountUp value={stat.value} />
                  </p>
                  <p className="mt-2 text-[11px] text-neutral-600">{stat.note}</p>
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06]", stat.orb, stat.tone)}>
                  <stat.icon className="h-[18px] w-[18px]" />
                </div>
              </div>
            </motion.div>
          ))}
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101114]">
            <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-white">Список платежей</h2>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] tabular-nums text-neutral-400">
                      {filtered.length} из {occurrences.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">Управляйте статусами и контролируйте ближайшие даты</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-1">
                  <button
                    onClick={() => setView("list")}
                    className={cn("rounded-lg px-3 py-1.5 text-xs transition", view === "list" ? "bg-white/[0.10] text-white shadow-sm" : "text-neutral-500 hover:text-white")}
                  >
                    Список
                  </button>
                  <button
                    onClick={() => setView("timeline")}
                    className={cn("rounded-lg px-3 py-1.5 text-xs transition", view === "timeline" ? "bg-white/[0.10] text-white shadow-sm" : "text-neutral-500 hover:text-white")}
                  >
                    Хронология
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/20 p-1">
                  {FILTERS.map((item) => {
                    const Icon = item.icon;
                    const active = filter === item.key;
                    const count =
                      item.key === "all" ? stats.total :
                      item.key === "unpaid" ? stats.unpaid :
                      item.key === "overdue" ? stats.overdue : stats.paid;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setFilter(item.key)}
                        className={cn(
                          "relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
                          active ? "text-white" : "text-neutral-500 hover:text-neutral-200"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="payment-filter-indicator"
                            className="absolute inset-0 rounded-lg border border-rose-400/15 bg-rose-500/[0.13]"
                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          />
                        )}
                        <Icon className={cn("relative z-10 h-3.5 w-3.5", active && "text-rose-300")} />
                        <span className="relative z-10">{item.label}</span>
                        <span className={cn("relative z-10 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums", active ? "bg-rose-400/10 text-rose-200" : "bg-white/[0.04] text-neutral-600")}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 text-[11px] text-neutral-500">
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Валюта
                  </div>
                  <div className="flex rounded-xl border border-white/[0.07] bg-black/20 p-1">
                    {(["all", "RUB", "USD", "EUR"] as const).map((value) => (
                      <button
                        key={value}
                        onClick={() => setCurrency(value)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[11px] transition",
                          currency === value ? "bg-white/[0.10] text-white" : "text-neutral-500 hover:text-white"
                        )}
                      >
                        {value === "all" ? "Все" : value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-rose-400 border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-500">
                  <Search className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-medium text-neutral-300">Платежи не найдены</p>
                <p className="mt-1 max-w-sm text-xs text-neutral-600">Измените фильтры или поисковый запрос. Если записей ещё нет, добавьте первый регулярный платёж.</p>
                <button onClick={() => { setSearch(""); setFilter("all"); setCurrency("all"); }} className="mt-4 text-xs font-medium text-rose-300 hover:text-rose-200">
                  Сбросить фильтры
                </button>
              </div>
            ) : view === "timeline" ? (
              <div className="p-5 lg:p-6">
                <PaymentTimeline items={filtered} onTogglePaid={handleTogglePaid} />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600 lg:px-6">
                  <HandCheckbox
                    checked={filtered.length > 0 && filtered.every((item) => selected.has(item.id))}
                    onChange={toggleAllVisible}
                    label="Выбрать все видимые платежи"
                  />
                  <span className="min-w-0 flex-1">Платёж / срок</span>
                  <span className="hidden w-32 text-right sm:block">Сумма</span>
                  <span className="hidden w-36 text-center md:block">Статус</span>
                  <span className="w-20 text-right">Действие</span>
                </div>

                <div>
                  <AnimatePresence initial={false}>
                    {filtered.map((item, index) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.12) }}
                        className={cn(
                          "group flex items-center gap-3 border-b border-white/[0.045] px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.025] lg:gap-4 lg:px-6",
                          item.is_overdue && !item.is_paid && "bg-rose-500/[0.025]"
                        )}
                      >
                        <HandCheckbox
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          label={`Выбрать платёж ${item.name || item.id}`}
                        />

                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                          item.is_paid ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300" :
                          item.is_overdue ? "border-rose-400/15 bg-rose-400/[0.07] text-rose-300" :
                          "border-white/[0.07] bg-white/[0.035] text-neutral-400"
                        )}>
                          {item.is_paid ? <CheckCheck className="h-4 w-4" /> : item.is_overdue ? <AlertTriangle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-neutral-100">{item.name || "Без названия"}</span>
                            <span className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide", CURRENCY_STYLE[item.currency || "RUB"] || CURRENCY_STYLE.RUB)}>
                              {item.currency || "—"}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
                            <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Срок: {formatDate(item.due_date)}</span>
                            {item.paid_at && <span className="text-emerald-400/70">· Оплачено: {formatDate(item.paid_at)}</span>}
                          </div>
                          <div className="mt-2 md:hidden"><StatusBadge item={item} /></div>
                        </div>

                        <div className="hidden w-32 shrink-0 text-right sm:block">
                          <div className="text-sm font-semibold tabular-nums text-white">{formatMoney(item.amount, item.currency)}</div>
                          <div className="mt-1 text-[10px] text-neutral-600">Сумма обязательства</div>
                        </div>

                        <div className="hidden w-36 shrink-0 justify-center md:flex">
                          <StatusBadge item={item} />
                        </div>

                        <div className="flex w-20 shrink-0 items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailsTarget(item)}
                            aria-label={`Подробнее о платеже ${item.name || item.id}`}
                            title="Подробнее"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void handleTogglePaid(item)}
                            disabled={busyId === item.id}
                            title={item.is_paid ? "Отменить оплату" : "Отметить оплаченным"}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-40",
                              item.is_paid ? "text-neutral-500 hover:bg-white/[0.06] hover:text-white" : "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                            )}
                          >
                            {item.is_paid ? <MoreHorizontal className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-2 border-t border-white/[0.06] bg-black/15 px-5 py-3 text-[11px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between lg:px-6">
                  <span>Показано {filtered.length} из {occurrences.length} записей</span>
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" /> Изменения сохраняются в системе</span>
                </div>
              </>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-rose-400/15 bg-gradient-to-br from-[#211116] via-[#151014] to-[#101114] p-5">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-rose-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200/70">
                  <CalendarClock className="h-3.5 w-3.5" /> Ближайший платёж
                </div>
                {upcoming ? (
                  <>
                    <h3 className="mt-4 line-clamp-2 text-lg font-semibold leading-snug text-white">{upcoming.name || "Без названия"}</h3>
                    <p className="mt-1 text-xs text-neutral-400">Срок: {formatDate(upcoming.due_date)}</p>
                    <p className="mt-4 text-2xl font-semibold tracking-tight text-white">{formatMoney(upcoming.amount, upcoming.currency)}</p>
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                      <span className="text-[11px] text-neutral-500">Статус обязательства</span>
                      <StatusBadge item={upcoming} />
                    </div>
                    <button onClick={() => setDetailsTarget(upcoming)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-neutral-200 transition hover:bg-white/[0.08]">
                      Открыть детали <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
                    <div className="text-sm font-medium text-neutral-200">Нет предстоящих платежей</div>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">Среди неоплаченных записей не найдено будущих дат.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#101114] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Быстрые действия</h3>
                  <p className="mt-1 text-[11px] text-neutral-600">Работа с обязательствами</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-neutral-400"><Filter className="h-4 w-4" /></div>
              </div>
              <div className="mt-4 space-y-2">
                <button onClick={() => setModalOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition hover:border-rose-400/20 hover:bg-rose-400/[0.05]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-400/10 text-rose-300"><FilePlus2 className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-neutral-200">Создать платёж</span><span className="mt-0.5 block text-[10px] text-neutral-600">Новое регулярное обязательство</span></span>
                  <Plus className="h-4 w-4 text-neutral-600" />
                </button>
                <button onClick={() => { setFilter("overdue"); setCurrency("all"); setSearch(""); }} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition hover:border-rose-400/20 hover:bg-rose-400/[0.05]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-300/[0.08] text-amber-200"><AlertTriangle className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-neutral-200">Проверить просрочки</span><span className="mt-0.5 block text-[10px] text-neutral-600">{stats.overdue} платежей требуют внимания</span></span>
                  <ArrowDownLeft className="h-4 w-4 text-neutral-600" />
                </button>
                <button onClick={() => { setFilter("unpaid"); setCurrency("all"); setSearch(""); }} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition hover:border-rose-400/20 hover:bg-rose-400/[0.05]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-300/[0.08] text-sky-200"><Clock3 className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-neutral-200">Ожидают оплаты</span><span className="mt-0.5 block text-[10px] text-neutral-600">{stats.unpaid} неоплаченных записей</span></span>
                  <ChevronDown className="h-4 w-4 text-neutral-600" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#101114] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-300"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Безопасность данных</div>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">Статусы и суммы загружаются из текущего API. Демонстрационные балансы и фиктивные банковские операции не добавляются.</p>
            </div>
          </aside>
        </section>
      </main>

      <AddPaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          void loadData();
          showSuccess("Регулярный платёж создан");
        }}
      />

      <AnimatePresence>
        {detailsTarget && (
          <>
            <motion.button
              aria-label="Закрыть детали платежа"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailsTarget(null)}
              className="fixed inset-0 z-40 cursor-default bg-black/65 backdrop-blur-sm"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Детали платежа"
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-white/[0.08] bg-[#101114] shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-white/[0.07] p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">Карточка платежа</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">{detailsTarget.name || "Без названия"}</h2>
                  <p className="mt-1 text-xs text-neutral-500">Запись #{detailsTarget.id}</p>
                </div>
                <button onClick={() => setDetailsTarget(null)} className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/[0.06] hover:text-white" aria-label="Закрыть"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                  <p className="text-xs text-neutral-500">Сумма обязательства</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{formatMoney(detailsTarget.amount, detailsTarget.currency)}</p>
                  <div className="mt-3"><StatusBadge item={detailsTarget} /></div>
                </div>
                {[
                  ["Дата платежа", formatDate(detailsTarget.due_date)],
                  ["Валюта", detailsTarget.currency || "—"],
                  ["ID регулярного платежа", String(detailsTarget.recurring_payment_id)],
                  ["Фактическая дата оплаты", detailsTarget.paid_at ? formatDate(detailsTarget.paid_at) : "Не оплачено"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-3">
                    <span className="text-xs text-neutral-500">{label}</span>
                    <span className="text-right text-xs font-medium text-neutral-200">{value}</span>
                  </div>
                ))}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-[11px] leading-relaxed text-neutral-500">
                  <Info className="mb-2 h-4 w-4 text-neutral-400" />
                  Это регулярное обязательство. Деактивация отключает сам регулярный платёж, а не только текущую запись.
                </div>
              </div>
              <div className="border-t border-white/[0.07] p-5">
                <button
                  disabled={busyId === detailsTarget.id}
                  onClick={() => { const item = detailsTarget; setDetailsTarget(null); void handleTogglePaid(item); }}
                  className={cn("flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition disabled:opacity-50", detailsTarget.is_paid ? "border border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white/[0.08]" : "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110")}
                >
                  {detailsTarget.is_paid ? <><X className="h-4 w-4" /> Отменить оплату</> : <><Check className="h-4 w-4" /> Отметить оплаченным</>}
                </button>
                <button onClick={() => { setDeleteTarget(detailsTarget); setDetailsTarget(null); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/15 px-4 py-3 text-xs text-rose-300 transition hover:bg-rose-400/[0.07]">
                  <Trash2 className="h-3.5 w-3.5" /> Деактивировать регулярный платёж
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(deleteTarget || bulkDeleteOpen) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.button
              aria-label="Закрыть подтверждение"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setDeleteTarget(null); setBulkDeleteOpen(false); }}
              className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-title"
              aria-describedby="delete-description"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#151518] p-6 shadow-2xl"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300"><Trash2 className="h-5 w-5" /></div>
              <h2 id="delete-title" className="mt-4 text-lg font-semibold text-white">Деактивировать платёж?</h2>
              <p id="delete-description" className="mt-2 text-sm leading-relaxed text-neutral-400">
                {bulkDeleteOpen
                  ? `Будет деактивировано ${new Set(occurrences.filter((item) => selected.has(item.id)).map((item) => item.recurring_payment_id)).size} регулярных платежей. Действие затронет связанные будущие обязательства.`
                  : `«${deleteTarget?.name || "Без названия"}» будет деактивирован. Это действие затронет регулярный платёж, а не только одну дату.`}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => { setDeleteTarget(null); setBulkDeleteOpen(false); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.05]">Отмена</button>
                <button onClick={() => bulkDeleteOpen ? void bulkDeactivate() : void handleDelete()} className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-400">
                  Деактивировать
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="fixed bottom-5 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-[#1b1b1f] px-4 py-3 shadow-2xl"
            role="status"
            aria-live="polite"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><Check className="h-4 w-4" /></div>
            <span className="min-w-0 flex-1 text-xs text-neutral-200">{toast.message}</span>
            {toast.undo && <button onClick={toast.undo} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/10">Отменить</button>}
            <button onClick={() => setToast(null)} aria-label="Закрыть уведомление" className="shrink-0 text-neutral-600 transition hover:text-white"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
