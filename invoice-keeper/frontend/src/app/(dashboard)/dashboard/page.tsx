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
import { AppDock } from "@/components/layout/app-dock";
import { FolderCard } from "@/components/3d/folder-card";
import { AddPaymentModal } from "@/components/dashboard/add-payment-modal";
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Загрузка личного дела...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 relative overflow-hidden">
      <SparklesBackground />

      {/* Header */}
      <header className="relative z-20 border-b border-white/5 bg-[#0a0a0f]/70 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">
                IK
              </div>
              <h1 className="text-lg font-semibold tracking-tight">
                Invoice Keeper
              </h1>
            </motion.div>
            <span className="text-[11px] text-gray-500 hidden sm:inline border border-white/10 px-2 py-0.5 rounded-full">
              Личное дело
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === "admin" && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setModalOpen(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-colors"
              >
                <span className="text-lg leading-none">+</span>
                Добавить платёж
              </motion.button>
            )}

            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">{user?.username}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 uppercase">
                {user?.role}
              </span>
            </div>

            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            Регулярные обязательства
          </h2>
          <p className="text-gray-500">
            Контроль платежей · напоминания · история
          </p>
        </motion.div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {summary.map((s, i) => (
            <motion.div
              key={s.currency}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-violet-600/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-[#12121a]/80 backdrop-blur border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-colors">
                <div className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">
                  {s.currency}
                </div>
                <div className="text-2xl font-bold tracking-tight mb-4">
                  {formatMoney(s.total_amount, s.currency)}
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-emerald-400/90">
                    ✓ {s.count_paid} оплачено
                  </span>
                  <span className="text-amber-400/90">
                    ○ {s.count_unpaid} ждёт
                  </span>
                  <span className="text-red-400/90">
                    ! {s.count_overdue} просрочено
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters + Add button mobile */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex gap-2">
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
                  "px-4 py-1.5 rounded-full text-sm transition-all duration-200",
                  filter === key
                    ? "bg-white text-black font-medium"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {user?.role === "admin" && (
            <button
              onClick={() => setModalOpen(true)}
              className="sm:hidden px-4 py-2 rounded-xl bg-blue-600 text-sm font-medium"
            >
              + Добавить
            </button>
          )}
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4 opacity-20">📁</div>
            <p className="text-gray-500 mb-6">
              {occurrences.length === 0
                ? "Пока нет платежей в личном деле"
                : "Нет платежей по выбранному фильтру"}
            </p>
            {user?.role === "admin" && occurrences.length === 0 && (
              <button
                onClick={() => setModalOpen(true)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                Добавить первый платёж
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
