"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createRecurringPayment } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPaymentModal({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    amount: "",
    currency: "RUB" as "RUB" | "USD" | "EUR",
    next_due_date: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createRecurringPayment({
        name: form.name,
        amount: parseFloat(form.amount),
        currency: form.currency,
        next_due_date: form.next_due_date,
        periodicity: "monthly",
        description: form.description || null,
      });
      onSuccess();
      onClose();
      setForm({
        name: "",
        amount: "",
        currency: "RUB",
        next_due_date: "",
        description: "",
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка при создании");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-lg z-10"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="text-base font-medium text-white tracking-tight">
                  Новый платёж
                </h2>
                <button
                  onClick={onClose}
                  className="text-neutral-500 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Name - full width */}
                <div>
                  <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                    Название
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Аренда офиса"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  />
                </div>

                {/* Amount + Currency - horizontal */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
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
                      className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                      Валюта
                    </label>
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm({ ...form, currency: e.target.value as any })
                      }
                      className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                    >
                      <option value="RUB">RUB</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                    Дата ближайшей оплаты
                  </label>
                  <input
                    required
                    type="date"
                    value={form.next_due_date}
                    onChange={(e) =>
                      setForm({ ...form, next_due_date: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                    Описание
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={2}
                    placeholder="Необязательно"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                {/* Actions - horizontal */}
                <div className="flex gap-3 pt-1">
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
                    {loading ? "Создание..." : "Создать"}
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
