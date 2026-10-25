
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  getTelegramStatus,
  createTelegramLinkCode,
  unlinkTelegram,
  getPaymentOccurrences,
  getPaymentsSummary,
  type TelegramStatus,
  type TelegramLinkCode,
} from "@/lib/api";

type Occurrence = {
  id: number;
  recurring_payment_id: number;
  due_date: string;
  is_paid: boolean;
  is_overdue: boolean;
  name?: string | null;
  amount?: number | string | null;
  currency?: string | null;
};

export default function TgAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<TelegramLinkCode | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAll, setShowAll] = useState(false);


  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const telegram = await getTelegramStatus();
      setStatus(telegram);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Не удалось проверить Telegram: ${err.message}`
          : "Не удалось проверить Telegram"
      );
    }

    try {
      const payments = await getPaymentOccurrences();
      const list = Array.isArray(payments)
        ? payments
        : Array.isArray(payments?.items)
          ? payments.items
          : [];

      setOccurrences(list);
    } catch (err: unknown) {
      setError((previous) =>
        [
          previous,
          err instanceof Error
            ? `Не удалось загрузить платежи: ${err.message}`
            : "Не удалось загрузить платежи",
        ]
          .filter(Boolean)
          .join(". ")
      );
    }

    try {
      await getPaymentsSummary();
    } catch {
      // Ошибка сводки не должна сбрасывать статус Telegram.
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  async function handleCreateCode() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await createTelegramLinkCode();
      setLinkCode(result);
      setNotice("Код создан. Отправь его своему Telegram-боту.");
      await refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Не удалось создать код"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyCode() {
    if (!linkCode) return;

    try {
      await navigator.clipboard.writeText(linkCode.code);
      setNotice("Код скопирован");
    } catch {
      setError("Не удалось скопировать код. Скопируй его вручную.");
    }
  }

  async function handleUnlink() {
    if (!window.confirm("Отвязать Telegram от аккаунта?")) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await unlinkTelegram();
      setLinkCode(null);
      setNotice("Telegram отвязан");
      await refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Не удалось отвязать Telegram"
      );
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(item: Occurrence) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api.patch(`/payment-occurrences/${item.id}`, {
        is_paid: true,
      });
      setNotice("Платёж отмечен оплаченным");
      await refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Не удалось обновить платёж"
      );
    } finally {
      setBusy(false);
    }
  }

  const overdue = occurrences.filter(
    (item) => item.is_overdue && !item.is_paid
  );
  const upcoming = occurrences.filter(
    (item) => !item.is_paid && !item.is_overdue
  );
  const visibleItems = showAll ? occurrences.filter((item) => !item.is_paid) : overdue;

  return (
    <div className="fixed bottom-5 right-5 z-[100]">
      {isOpen && (
        <section
          aria-label="Telegram-ассистент"
          className="mb-3 flex max-h-[min(680px,calc(100dvh-110px))] w-[min(370px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-[#0b0c0f] text-neutral-100 shadow-2xl shadow-black/50"
        >
          <header className="flex items-center gap-3 border-b border-neutral-800 bg-[#111318] p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-white"
                aria-hidden="true"
              >
                <path d="M21.8 3.2a1.4 1.4 0 0 0-1.5-.2L2.6 9.8c-1.2.5-1.2 1.2-.2 1.5l4.5 1.4 1.7 5.3c.2.6.1.8.7.8.5 0 .7-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.3 1.6-.8l3-14.1c.2-.9-.2-1.4-.8-1.5ZM8 12.4l9.8-6.2c.5-.3.9-.1.5.2l-8.1 7.4-.3 3.2L8 12.4Z" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Telegram-ассистент</h2>
              <p className="mt-0.5 text-xs text-neutral-400">
                {status?.linked
                  ? "Аккаунт подключён"
                  : "Платежи и уведомления"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть ассистента"
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              ×
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {error && (
              <div
                role="alert"
                className="break-words rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            {notice && (
              <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">
                {notice}
              </div>
            )}

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Подключение Telegram</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {loading && !status
                      ? "Проверяем подключение…"
                      : status?.linked
                        ? "Бот связан с твоим аккаунтом"
                        : "Бот ещё не подключён"}
                  </p>
                </div>

                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    status?.linked ? "bg-emerald-400" : "bg-neutral-600"
                  }`}
                />
              </div>

              <div className="mt-3">
                {status?.linked ? (
                  <button
                    type="button"
                    onClick={() => void handleUnlink()}
                    disabled={busy}
                    className="w-full rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                  >
                    Отвязать Telegram
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCreateCode()}
                    disabled={busy || loading}
                    className="w-full rounded-lg bg-sky-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    {busy ? "Подождите…" : "Подключить Telegram"}
                  </button>
                )}
              </div>

              {linkCode && !status?.linked && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-neutral-300">
                    {linkCode.instruction}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 rounded-lg bg-black p-3 text-center text-lg font-bold tracking-widest">
                      {linkCode.code}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyCode()}
                      className="rounded-lg border border-neutral-700 px-3 py-3 text-xs hover:bg-neutral-800"
                    >
                      Копировать
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Код действует примерно{" "}
                    {Math.ceil(linkCode.expires_in_seconds / 60)} мин.
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Мои платежи</h3>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={loading || busy}
                  className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
                >
                  {loading ? "Обновляем…" : "Обновить"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                  <p className="text-[11px] text-neutral-400">Всего</p>
                  <p className="mt-1 text-xl font-semibold">
                    {occurrences.length}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                  <p className="text-[11px] text-neutral-400">Скоро</p>
                  <p className="mt-1 text-xl font-semibold">{upcoming.length}</p>
                </div>
                <div className="rounded-xl border border-red-950 bg-red-950/30 p-3">
                  <p className="text-[11px] text-red-300">Просрочено</p>
                  <p className="mt-1 text-xl font-semibold text-red-300">
                    {overdue.length}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {showAll ? "Активные платежи" : "Просроченные"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAll((value) => !value)}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  {showAll ? "Только просроченные" : "Все активные"}
                </button>
              </div>

              {loading && occurrences.length === 0 ? (
                <p className="py-4 text-center text-sm text-neutral-400">
                  Загружаем платежи…
                </p>
              ) : visibleItems.length === 0 ? (
                <div className="rounded-xl border border-neutral-800 p-4 text-center">
                  <p className="text-sm text-neutral-300">
                    {showAll
                      ? "Нет активных платежей"
                      : "Просроченных платежей нет"}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Здесь появятся актуальные начисления.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {visibleItems.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">
                            {item.name ||
                              `Платёж #${item.recurring_payment_id}`}
                          </p>
                          <p className="mt-1 text-xs text-neutral-400">
                            Срок: {item.due_date}
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {item.amount ?? "—"} {item.currency ?? ""}
                          </p>
                        </div>
                        {item.is_overdue && (
                          <span className="shrink-0 rounded-md bg-red-950 px-2 py-1 text-[10px] text-red-300">
                            Просрочен
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void markPaid(item)}
                        disabled={busy}
                        className="mt-3 w-full rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:border-emerald-700 hover:bg-emerald-950/30 disabled:opacity-50"
                      >
                        Отметить оплаченным
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <footer className="border-t border-neutral-800 p-3">
            <p className="text-center text-[11px] text-neutral-500">
              Данные синхронизируются с твоим аккаунтом
            </p>
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={
          isOpen ? "Закрыть Telegram-ассистента" : "Открыть Telegram-ассистента"
        }
        aria-expanded={isOpen}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full border border-sky-300/30 bg-sky-500 text-white shadow-lg shadow-sky-950/50 transition hover:scale-105 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        {isOpen ? (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 fill-none stroke-current"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="ml-0.5 h-7 w-7 fill-current"
            aria-hidden="true"
          >
            <path d="M21.8 3.2a1.4 1.4 0 0 0-1.5-.2L2.6 9.8c-1.2.5-1.2 1.2-.2 1.5l4.5 1.4 1.7 5.3c.2.6.1.8.7.8.5 0 .7-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.3 1.6-.8l3-14.1c.2-.9-.2-1.4-.8-1.5ZM8 12.4l9.8-6.2c.5-.3.9-.1.5.2l-8.1 7.4-.3 3.2L8 12.4Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
