"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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

const CURRENCY_STYLE: Record<string, string> = {
  RUB: "bg-neutral-800 text-neutral-200 border-neutral-600",
  USD: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  EUR: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, fetchMe } = useAuthStore();
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "overdue" | "paid">("all");
  const [currency, setCurrency] = useState<"all" | "RUB" | "USD" | "EUR">("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "timeline">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!token && !localStorage.getItem("access_token")) {
      router.push("/login");
      return;
    }
    fetchMe().then(() => loadData());
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const occData = await getPaymentOccurrences();
      setOccurrences(occData.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 2500);
  };

  const handleTogglePaid = async (item: Occurrence) => {
    try {
      await updatePaymentOccurrence(item.id, {
        is_paid: !item.is_paid,
        paid_at: !item.is_paid ? new Date().toISOString().slice(0, 10) : null,
      });
      showSuccess(item.is_paid ? "Оплата отменена" : "Оплачено · следующий период создан");
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (item: Occurrence) => {
    if (!confirm(`Деактивировать «${item.name}»?`)) return;
    try {
      await deleteRecurringPayment(item.recurring_payment_id);
      showSuccess("Деактивировано");
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const bulkDeactivate = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Деактивировать ${selected.size} записей?`)) return;
    const ids = Array.from(
      new Set(
        occurrences
          .filter((o) => selected.has(o.id))
          .map((o) => o.recurring_payment_id)
      )
    );
    try {
      await api.post("/recurring-payments/bulk-deactivate", { ids });
      setSelected(new Set());
      showSuccess(`Деактивировано: ${ids.length}`);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = useMemo(() => {
    return occurrences.filter((o) => {
      if (filter === "paid" && !o.is_paid) return false;
      if (filter === "unpaid" && o.is_paid) return false;
      if (filter === "overdue" && !o.is_overdue) return false;
      if (currency !== "all" && o.currency !== currency) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${o.name || ""} ${o.currency || ""} ${o.due_date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [occurrences, filter, currency, search]);

  const formatMoney = (amount: number | string | null, cur: string | null) => {
    if (amount == null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: cur || "RUB",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="min-h-screen w-full">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#050505]/90 backdrop-blur-xl">
        <div className="w-full px-6 lg:px-10 h-14 flex items-center gap-4">
          <div className="shrink-0">
            <h1 className="text-sm font-semibold text-white">Платежи</h1>
            <p className="text-[10px] text-neutral-500 hidden sm:block">
              Обязательства · сроки · оплата
            </p>
          </div>

          <div className="flex-1 max-w-xl relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, валюте, дате..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#111] border border-white/10 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/40"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 text-sm">
              ⌕
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {selected.size > 0 && (
              <button
                onClick={bulkDeactivate}
                className="h-9 px-3 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10"
              >
                Удалить ({selected.size})
              </button>
            )}
            <div className="flex rounded-lg border border-white/10 p-0.5">
              {(["list", "timeline"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs transition-all",
                    view === v ? "bg-white text-black" : "text-neutral-500 hover:text-white"
                  )}
                >
                  {v === "list" ? "Список" : "Timeline"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
            >
              + Платёж
            </button>
          </div>
        </div>
      </header>

      <div className="w-full px-6 lg:px-10 py-6">
        <WelcomeBanner username={user?.username} role={user?.role} />

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-sm"
          >
            {successMsg}
          </motion.div>
        )}

        {/* Filters full width */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-[11px] text-neutral-600 uppercase tracking-wider mr-1">
            Статус
          </span>
          {(
            [
              ["all", "Все"],
              ["unpaid", "Не оплачены"],
              ["overdue", "Просрочены"],
              ["paid", "Оплачены"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-all",
                filter === key
                  ? "bg-blue-600 text-white"
                  : "text-neutral-500 border border-white/10 hover:border-white/20 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
          <span className="w-px h-4 bg-white/10 mx-2" />
          <span className="text-[11px] text-neutral-600 uppercase tracking-wider mr-1">
            Валюта
          </span>
          {(["all", "RUB", "USD", "EUR"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                currency === c
                  ? "bg-white text-black"
                  : "text-neutral-500 border border-white/10 hover:border-white/20 hover:text-white"
              )}
            >
              {c === "all" ? "Все" : c}
            </button>
          ))}
          <span className="ml-auto text-xs text-neutral-600">
            {filtered.length} из {occurrences.length}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-neutral-600 text-sm">
            Ничего не найдено
          </div>
        ) : view === "timeline" ? (
          <PaymentTimeline items={filtered} onTogglePaid={handleTogglePaid} />
        ) : (
          <div className="space-y-2 w-full">
            {filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.25) }}
                className={cn(
                  "group flex items-center gap-3 sm:gap-4 px-4 py-3.5 rounded-xl border bg-[#0c0c0c] transition-colors w-full",
                  item.is_overdue && !item.is_paid
                    ? "border-red-500/30"
                    : "border-white/[0.06] hover:border-white/12"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="rounded border-white/20 bg-transparent accent-blue-500"
                />

                <span
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 min-w-[3rem] text-center",
                    CURRENCY_STYLE[item.currency || "RUB"] || CURRENCY_STYLE.RUB
                  )}
                >
                  {item.currency || "—"}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-white truncate">
                      {item.name || "Без названия"}
                    </span>
                    {item.is_paid && (
                      <span className="text-[10px] text-green-400 border border-green-500/25 bg-green-500/10 px-1.5 py-0.5 rounded">
                        Оплачено
                      </span>
                    )}
                    {item.is_overdue && !item.is_paid && (
                      <span className="text-[10px] text-red-400 border border-red-500/25 bg-red-500/10 px-1.5 py-0.5 rounded">
                        Просрочено
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Срок: {item.due_date}
                    {item.paid_at && ` · Факт: ${item.paid_at}`}
                  </div>
                </div>

                <div className="text-sm font-semibold tabular-nums text-white shrink-0">
                  {formatMoney(item.amount, item.currency)}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleTogglePaid(item)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      item.is_paid
                        ? "border border-white/10 text-neutral-400 hover:bg-white/5"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    )}
                  >
                    {item.is_paid ? "Отменить" : "Оплачено"}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1.5 rounded-lg text-xs text-neutral-500 hover:text-red-400 transition-all"
                  >
                    Удалить
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AddPaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          loadData();
          showSuccess("Платёж создан");
        }}
      />
    </div>
  );
}
