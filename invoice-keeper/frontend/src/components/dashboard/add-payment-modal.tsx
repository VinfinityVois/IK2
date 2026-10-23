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
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 shadow-2xl mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Новый платёж
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-white transition-colors text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Название
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Аренда офиса"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">
                      Сумма
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      placeholder="50000"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">
                      Валюта
                    </label>
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          currency: e.target.value as any,
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    >
                      <option value="RUB">RUB</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Дата ближайшей оплаты
                  </label>
                  <input
                    required
                    type="date"
                    value={form.next_due_date}
                    onChange={(e) =>
                      setForm({ ...form, next_due_date: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-none"
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
                  >
                    {loading ? "Создание..." : "Создать"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
