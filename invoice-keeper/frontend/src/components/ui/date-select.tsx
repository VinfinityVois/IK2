"use client";

import { cn } from "@/lib/utils";

const MONTHS = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function DateSelect({
  value,
  onChange,
  className,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  className?: string;
}) {
  const [y, m, d] = value
    ? value.split("-").map((x) => parseInt(x, 10))
    : [2026, 1, 1];

  const years = Array.from({ length: 15 }, (_, i) => 2026 + i);
  const maxDay = daysInMonth(y || 2026, m || 1);
  const day = Math.min(d || 1, maxDay);

  const set = (ny: number, nm: number, nd: number) => {
    const md = daysInMonth(ny, nm);
    const dd = Math.min(nd, md);
    const ys = String(ny).slice(0, 4); // max 4 digits
    onChange(
      `${ys}-${String(nm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
    );
  };

  const sel =
    "px-2 py-2 rounded-lg bg-[#111] border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50";

  return (
    <div className={cn("flex gap-2", className)}>
      <select
        className={cn(sel, "flex-[1.2]")}
        value={day}
        onChange={(e) => set(y, m, parseInt(e.target.value, 10))}
      >
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((dd) => (
          <option key={dd} value={dd}>
            {dd}
          </option>
        ))}
      </select>
      <select
        className={cn(sel, "flex-[1.4]")}
        value={m}
        onChange={(e) => set(y, parseInt(e.target.value, 10), day)}
      >
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={cn(sel, "flex-[1.2]")}
        value={y}
        onChange={(e) => set(parseInt(e.target.value, 10), m, day)}
      >
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
    </div>
  );
}
