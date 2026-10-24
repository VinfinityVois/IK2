"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function TgAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#229ED9] hover:bg-[#1b8bc0] text-white shadow-lg shadow-blue-900/30 flex items-center justify-center transition-colors"
        title="Telegram-ассистент"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.09.13.21.14.27-.01.06-.01.13-.02.2z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="fixed bottom-22 right-6 z-50 w-80 rounded-xl border border-white/10 bg-[#0c0c0c] shadow-2xl overflow-hidden"
            style={{ bottom: 88 }}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#229ED9]/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#229ED9] flex items-center justify-center text-xs font-bold">
                  TG
                </div>
                <div>
                  <div className="text-sm font-medium">Ассистент</div>
                  <div className="text-[10px] text-neutral-500">Напоминания · скоро</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-500 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm text-neutral-400">
              <p>
                Здесь будет мини-бот: статус напоминаний, быстрая отметка «оплачено»
                из Telegram и лог последних сообщений.
              </p>
              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-neutral-600">
                Зачинка: подключи <code className="text-blue-400">TELEGRAM_BOT_TOKEN</code> в
                backend/.env — воркер уже шлёт напоминания за 3 дня.
              </div>
              <a
                href="http://127.0.0.1:8000/api/v1/docs"
                target="_blank"
                className="inline-block text-xs text-blue-400 hover:underline"
              >
                API docs → run-reminders
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
