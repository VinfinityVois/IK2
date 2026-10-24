
"use client";

import { useEffect, useMemo, useState } from "react";
import { getPaymentOccurrences } from "@/lib/api";

type O = {
  id: number;
  name?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  due_date: string;
  is_paid: boolean;
  is_overdue: boolean;
};

const week = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const key = (s: string) => s.slice(0, 10);

const fmt = (n: number, c = "RUB") =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(n);

export default function CalendarPage() {
  const now = new Date();

  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [items, setItems] = useState<O[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(key(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  ));

  const today = key(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );

  useEffect(() => {
    getPaymentOccurrences()
      .then((d) => setItems(d.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;

  const monthItems = useMemo(
    () => items.filter((x) => key(x.due_date).startsWith(prefix)),
    [items, prefix]
  );

  const dayItems = items.filter((x) => key(x.due_date) === selected);

  const cells = useMemo(() => {
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7;
    const count = new Date(y, m + 1, 0).getDate();
    const a: (number | null)[] = [];

    for (let i = 0; i < start; i++) a.push(null);
    for (let d = 1; d <= count; d++) a.push(d);
    while (a.length % 7) a.push(null);

    return a;
  }, [y, m]);

  const title = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m, 1));

  const overdue = items.filter(
    (x) => !x.is_paid && x.is_overdue
  ).length;

  const nextDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7
  );

  const nextDateKey = [
    nextDate.getFullYear(),
    String(nextDate.getMonth() + 1).padStart(2, "0"),
    String(nextDate.getDate()).padStart(2, "0"),
  ].join("-");

  const next = items.filter(
    (x) =>
      !x.is_paid &&
      key(x.due_date) >= today &&
      key(x.due_date) <= nextDateKey
  ).length;

  const amount = monthItems
    .filter((x) => !x.is_paid)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const move = (delta: number) => {
    const d = new Date(y, m + delta, 1);
    setY(d.getFullYear());
    setM(d.getMonth());
    setSelected(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
    );
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[.18em] text-rose-300">
            Планирование обязательств
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Календарь платежей
          </h1>

          <p className="mt-2 text-sm text-neutral-400">
            Сроки на основе текущих записей базы данных.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="h-10 w-10 rounded-xl border border-white/10 text-neutral-300 hover:bg-white/5"
            aria-label="Предыдущий месяц"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => {
              const current = new Date();
              setY(current.getFullYear());
              setM(current.getMonth());
              setSelected(today);
            }}
            className="rounded-xl border border-white/10 px-3 text-sm text-neutral-300"
          >
            Сегодня
          </button>

          <button
            type="button"
            onClick={() => move(1)}
            className="h-10 w-10 rounded-xl border border-white/10 text-neutral-300 hover:bg-white/5"
            aria-label="Следующий месяц"
          >
            →
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Платежей в месяце", loading ? "…" : String(monthItems.length), "Все статусы"],
          ["К оплате за месяц", loading ? "…" : fmt(amount), "Без конвертации валют"],
          ["Ближайшие 7 дней", loading ? "…" : String(next), "Неоплаченные"],
          ["Просрочено", loading ? "…" : String(overdue), "Требуют внимания"],
        ].map(([label, value, hint], i) => (
          <article
            key={label}
            className={`rounded-2xl border p-4 ${
              i === 3
                ? "border-rose-400/15 bg-rose-500/[.06]"
                : "border-white/[.07] bg-[#101012]"
            }`}
          >
            <p className="text-xs text-neutral-400">{label}</p>

            <p
              className={`mt-2 text-2xl font-semibold ${
                i === 3 && overdue ? "text-rose-300" : "text-white"
              }`}
            >
              {value}
            </p>

            <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="rounded-2xl border border-white/[.07] bg-[#101012] p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between px-1">
            <h2 className="text-lg font-semibold capitalize text-white">
              {title}
            </h2>

            <span className="text-xs text-neutral-500">
              {monthItems.length} событий
            </span>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {week.map((w) => (
              <div
                key={w}
                className="py-2 text-center text-[10px] uppercase tracking-wider text-neutral-500"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const k = d
                ? `${prefix}-${String(d).padStart(2, "0")}`
                : "";

              const events = d
                ? monthItems.filter((x) => key(x.due_date) === k)
                : [];

              return (
                <button
                  key={`${k || "blank"}-${i}`}
                  type="button"
                  disabled={d === null}
                  onClick={() => {
                    if (d !== null) setSelected(k);
                  }}
                  className={`min-h-[75px] rounded-xl border p-1.5 text-left transition sm:min-h-[100px] sm:p-2 ${
                    d === null
                      ? "border-transparent"
                      : "border-white/[.05] bg-white/[.015] hover:border-white/20"
                  } ${
                    k === selected
                      ? "!border-rose-400/60 !bg-rose-500/[.08]"
                      : ""
                  }`}
                >
                  {d !== null && (
                    <>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
                          k === today
                            ? "bg-rose-500 font-bold text-white"
                            : "text-neutral-300"
                        }`}
                      >
                        {d}
                      </span>

                      <div className="mt-1 space-y-1">
                        {events.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`truncate rounded px-1 py-0.5 text-[9px] sm:text-[10px] ${
                              event.is_paid
                                ? "bg-emerald-500/10 text-emerald-300"
                                : event.is_overdue
                                  ? "bg-rose-500/15 text-rose-300"
                                  : "bg-sky-500/10 text-sky-200"
                            }`}
                          >
                            {event.name || "Платёж"}
                          </div>
                        ))}

                        {events.length > 2 && (
                          <p className="text-[9px] text-neutral-500">
                            +{events.length - 2}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[.06] pt-4 text-[11px] text-neutral-400">
            <span>
              ● <span className="text-sky-300">Запланирован</span>
            </span>

            <span>
              ● <span className="text-rose-300">Просрочен</span>
            </span>

            <span>
              ● <span className="text-emerald-300">Оплачен</span>
            </span>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/[.07] bg-[#101012] p-5">
          <p className="text-[11px] uppercase tracking-widest text-rose-300">
            Выбранная дата
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            {selected
              ? new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${selected}T12:00:00`))
              : "Выберите день"}
          </h2>

          {loading ? (
            <p className="py-8 text-sm text-neutral-500">Загрузка…</p>
          ) : dayItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-sm text-neutral-300">Платежей нет</p>
              <p className="mt-1 text-xs text-neutral-500">
                События появятся после создания платежей.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {dayItems.map((x) => (
                <div
                  key={x.id}
                  className="rounded-xl border border-white/[.06] bg-black/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {x.name || "Без названия"}
                    </p>

                    <span
                      className={`rounded-full px-2 py-1 text-[10px] ${
                        x.is_paid
                          ? "bg-emerald-500/10 text-emerald-300"
                          : x.is_overdue
                            ? "bg-rose-500/10 text-rose-300"
                            : "bg-sky-500/10 text-sky-200"
                      }`}
                    >
                      {x.is_paid
                        ? "Оплачен"
                        : x.is_overdue
                          ? "Просрочен"
                          : "Ожидает"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-white">
                    {fmt(Number(x.amount || 0), x.currency || "RUB")}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-white/[.06] bg-white/[.02] p-3">
            <p className="text-xs font-medium text-neutral-300">
              Источник данных
            </p>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              События загружаются из{" "}
              <code>/payment-occurrences</code>; календарь не создаёт
              фиктивных платежей.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
