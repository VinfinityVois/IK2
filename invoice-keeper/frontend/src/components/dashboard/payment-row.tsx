"use client";

import { cn } from "@/lib/utils";

interface Props {
  id: number;
  name: string | null;
  amount: number | string | null;
  currency: string | null;
  dueDate: string;
  isPaid: boolean;
  paidAt: string | null;
  isOverdue: boolean;
  onTogglePaid: () => void;
  onDelete?: () => void;
}

export function PaymentRow({
  name,
  amount,
  currency,
  dueDate,
  isPaid,
  paidAt,
  isOverdue,
  onTogglePaid,
  onDelete,
}: Props) {
  const formatMoney = () => {
    if (amount == null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 border-b border-neutral-800/80 hover:bg-neutral-900/50 transition-colors",
        isOverdue && !isPaid && "bg-red-500/[0.03]"
      )}
    >
      {/* Status dot */}
      <div
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          isPaid ? "bg-emerald-500" : isOverdue ? "bg-red-500" : "bg-neutral-600"
        )}
      />

      {/* Name + date */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-100 truncate">
            {name || "Без названия"}
          </span>
          {isOverdue && !isPaid && (
            <span className="text-[10px] text-red-400 uppercase tracking-wide">
              просрочено
            </span>
          )}
          {isPaid && (
            <span className="text-[10px] text-emerald-400 uppercase tracking-wide">
              оплачено
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {dueDate}
          {paidAt && ` · факт ${paidAt}`}
        </div>
      </div>

      {/* Amount + currency */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-medium text-neutral-100 tabular-nums">
          {formatMoney()}
        </div>
        <div className="text-[11px] text-blue-400 font-medium tracking-wide">
          {currency || "—"}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onTogglePaid}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            isPaid
              ? "border border-neutral-700 text-neutral-400 hover:bg-neutral-800"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          )}
        >
          {isPaid ? "Отменить" : "Оплачено"}
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-2 py-1.5 rounded-md text-xs text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Деактивировать регулярный платёж"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
