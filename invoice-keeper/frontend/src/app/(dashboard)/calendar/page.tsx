"use client";

import { useMemo, useState } from "react";

const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function CalendarPage() {
  const [ym] = useState({ y: 2026, m: 10 }); // Nov 2026 = month 10 (0-index would be 10 for Nov)

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    // Monday-start
    let start = (first.getDay() + 6) % 7;
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < start; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [ym]);

  return (
    <div className="w-full px-6 lg:px-10 py-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Календарь выплат и напоминаний
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Плановый мониторинг сроков и регулярных расчётов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg border border-white/10 text-sm">
            Ноябрь 2026
          </span>
          <button className="h-9 px-3 rounded-lg bg-blue-600 text-sm text-white">
            + Запланировать
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          ["Всего в месяце", "—"],
          ["Ближайшие 7 дней", "—"],
          ["Критические сроки", "—"],
          ["Автосписания", "—"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
            <div className="text-[10px] uppercase text-neutral-500">{l}</div>
            <div className="text-lg font-semibold mt-1">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEK.map((w) => (
              <div key={w} className="text-center text-[10px] text-neutral-500 py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => (
              <div
                key={i}
                className={`min-h-[72px] rounded-lg border border-white/[0.04] p-1.5 text-xs ${
                  d ? "bg-white/[0.02] text-neutral-300" : "opacity-30"
                }`}
              >
                {d && <div className="font-medium text-neutral-400">{d}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4 space-y-3">
          <div className="text-sm font-medium">График на сегодня</div>
          <div className="text-xs text-neutral-500">
            Подключите платежи — сроки появятся на сетке автоматически из API occurrences.
          </div>
          <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-neutral-600">
            Демо-сетка · данные из `/payment-occurrences`
          </div>
        </div>
      </div>
    </div>
  );
}
