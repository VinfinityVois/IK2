"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createRecurringPayment } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DateSelect } from "@/components/ui/date-select";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: {
    id?: number;
    name?: string;
    amount?: string;
    currency?: string;
    next_due_date?: string;
    description?: string;
  } | null;
  mode?: "create" | "edit";
}

export function AddPaymentModal({
  open,
  onClose,
  onSuccess,
  initial,
  mode = "create",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: initial?.name || "",
    amount: initial?.amount || "",
    currency: (initial?.currency as "RUB" | "USD" | "EUR") || "RUB",
    next_due_date: initial?.next_due_date || "",
    description: initial?.description || "",
  });

  // sync when opening with initial
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setForm({
      name: initial?.name || "",
      amount: initial?.amount || "",
      currency: (initial?.currency as any) || "RUB",
      next_due_date: initial?.next_due_date || "",
      description: initial?.description || "",
    });
    setError("");
  }
  if (!open && prevOpen) setPrevOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "create") {
        await createRecurringPayment({
          name: form.name,
          amount: parseFloat(form.amount),
          currency: form.currency,
          next_due_date: form.next_due_date,
          periodicity: "monthly",
          description: form.description || null,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full px-3 py-2.5 rounded-lg bg-[#111] border border-white/10 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="relative w-full max-w-xl z-10"
          >
            <div className="bg-[#0c0c0c] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-base font-medium text-white">
                    {mode === "edit" ? "Редактирование" : "Новый платёж"}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Регулярное обязательство · ежемесячно
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                      Название
                    </label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Аренда офиса"
                      className={field}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                      Сумма
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="50000"
                      className={field}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                      Валюта
                    </label>
                    <div className="flex gap-2">
                      {(["RUB", "USD", "EUR"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, currency: c })}
                          className={cn(
                            "flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all",
                            form.currency === c
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-[#111] border-white/10 text-neutral-400 hover:border-white/20"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                      Дата ближайшей оплаты
                    </label>
                    <DateSelect
                      value={form.next_due_date || "2026-10-23"}
                      onChange={(v) => setForm({ ...form, next_due_date: v })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                      Описание
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      rows={2}
                      placeholder="Необязательно"
                      className={cn(field, "resize-none")}
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg border border-white/10 text-neutral-400 text-sm hover:bg-white/5 hover:text-white transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-all"
                  >
                    {loading
                      ? "Сохранение..."
                      : mode === "edit"
                      ? "Сохранить"
                      : "Создать"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
