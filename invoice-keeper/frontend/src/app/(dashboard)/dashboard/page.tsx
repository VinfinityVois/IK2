"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import {
  getPaymentOccurrences,
  getPaymentsSummary,
  updatePaymentOccurrence,
} from "@/lib/api";
import { SparklesBackground } from "@/components/ui/sparkles-bg";
import { FolderCard } from "@/components/3d/folder-card";
import { AddPaymentModal } from "@/components/dashboard/add-payment-modal";
import { PaymentTimeline } from "@/components/dashboard/payment-timeline";
import { AppDock } from "@/components/layout/app-dock";
import { cn } from "@/lib/utils";

interface Occurrence {
  id: number;
  name: string | null;
  amount: number | null;
  currency: string | null;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
  is_overdue: boolean;
}

interface SummaryItem {
  currency: string;
  total_amount: string;
  paid_amount: string;
  unpaid_amount: string;
  overdue_amount: string;
  count_total: number;
  count_paid: number;
  count_unpaid: number;
  count_overdue: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, logout, fetchMe } = useAuthStore();
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "overdue" | "paid">("all");
  const [view, setView] = useState<"cards" | "timeline">("timeline");
  const [modalOpen, setModalOpen] = useState(false);

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
      const [occData, sumData] = await Promise.all([
        getPaymentOccurrences(),
        getPaymentsSummary(),
      ]);
      setOccurrences(occData.items || []);
      setSummary(sumData.by_currency || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaid = async (item: Occurrence) => {
    try {
      await updatePaymentOccurrence(item.id, {
        is_paid: !item.is_paid,
        paid_at: !item.is_paid ? new Date().toISOString().slice(0, 10) : null,
      });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = occurrences.filter((o) => {
    if (filter === "paid") return o.is_paid;
    if (filter === "unpaid") return !o.is_paid;
    if (filter === "overdue") return o.is_overdue;
    return true;
  });

  const formatMoney = (amount: number | string | null, currency: string | null) => {
    if (amount == null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "RUB",
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (!user && loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-neutral-500">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 relative">
      <SparklesBackground />

      {/* Header */}
      <header className="relative z-20 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
              IK
            </div>
            <span className="text-sm font-medium tracking-tight">Invoice Keeper</span>
            <span className="text-[10px] text-neutral-600 border border-white/10 px-1.5 py-0.5 rounded hidden sm:inline">
              Личное дело
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === "admin" && (
              <button
                onClick={() => setModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
              >
                + Платёж
              </button>
            )}
            <span className="text-xs text-neutral-500">{user?.username}</span>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="text-xs text-neutral-600 hover:text-white transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-8 pb-28">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Регулярные обязательства
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Контроль · напоминания · история
            </p>
          </div>

          {/* View switcher */}
          <div className="flex rounded-lg border border-white/10 p-0.5 bg-white/[0.02]">
            <button
              onClick={() => setView("timeline")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs transition-all",
                view === "timeline"
                  ? "bg-white text-black font-medium"
                  : "text-neutral-500 hover:text-white"
              )}
            >
              Timeline
            </button>
            <button
              onClick={() => setView("cards")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs transition-all",
                view === "cards"
                  ? "bg-white text-black font-medium"
                  : "text-neutral-500 hover:text-white"
              )}
            >
              Карточки
            </button>
          </div>
        </div>

        {/* Summary - horizontal strip */}
        {summary.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {summary.map((s) => (
              <div
                key={s.currency}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02]"
              >
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-600">
                    {s.currency}
                  </div>
                  <div className="text-lg font-semibold text-white tabular-nums">
                    {formatMoney(s.total_amount, s.currency)}
                  </div>
                </div>
                <div className="text-right text-[11px] space-y-0.5">
                  <div className="text-blue-400">{s.count_paid} оплачено</div>
                  <div className="text-neutral-500">{s.count_unpaid} ждёт</div>
                  {s.count_overdue > 0 && (
                    <div className="text-red-400">{s.count_overdue} просрочено</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
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
                "px-3 py-1 rounded-md text-xs transition-all",
                filter === key
                  ? "bg-blue-600 text-white"
                  : "text-neutral-500 hover:text-white border border-white/10 hover:border-white/20"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-600 text-sm mb-4">
              {occurrences.length === 0
                ? "Нет платежей"
                : "Нет платежей по фильтру"}
            </p>
            {user?.role === "admin" && occurrences.length === 0 && (
              <button
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm text-white"
              >
                Добавить первый платёж
              </button>
            )}
          </div>
        ) : view === "timeline" ? (
          <PaymentTimeline items={filtered} onTogglePaid={handleTogglePaid} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((item, i) => (
              <FolderCard
                key={item.id}
                name={item.name || "Без названия"}
                amount={item.amount}
                currency={item.currency}
                dueDate={item.due_date}
                isPaid={item.is_paid}
                isOverdue={item.is_overdue}
                onTogglePaid={() => handleTogglePaid(item)}
                index={i}
              />
            ))}
          </div>
        )}
      </main>

      <AppDock isAdmin={user?.role === "admin"} />

      <AddPaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
