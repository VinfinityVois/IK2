"use client";

const banks = [
  { name: "T-Банк (Бизнес)", bal: "184 250 400 ₽", tag: "Live", color: "from-yellow-500/20" },
  { name: "Альфа-Банк Корп.", bal: "136 101 580 ₽", tag: "Активен", color: "from-red-500/20" },
  { name: "Raiffeisen Int.", bal: "213 212 €", tag: "SEPA", color: "from-yellow-600/20" },
  { name: "Bank of Georgia", bal: "48 500 $", tag: "Резерв", color: "from-orange-500/20" },
];

export default function BanksPage() {
  return (
    <div className="w-full px-6 lg:px-10 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">
            Open Banking · демо
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Банки и счета</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Привязанные счета, остатки и распределение ликвидности
          </p>
        </div>
        <button className="h-9 px-4 rounded-xl bg-blue-600 text-sm font-medium text-white">
          + Подключить банк
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          ["Консолидированный", "344 872 980 ₽"],
          ["Зарезервировано", "54 200 000 ₽"],
          ["Валютный резерв", "261 712 $"],
          ["Запланировано", "18 счетов"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
            <div className="text-[10px] uppercase text-neutral-500 mb-1">{l}</div>
            <div className="text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {banks.map((b) => (
          <div
            key={b.name}
            className={`rounded-xl border border-white/[0.06] bg-gradient-to-br ${b.color} to-transparent p-5`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="text-sm font-medium">{b.name}</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                {b.tag}
              </span>
            </div>
            <div className="text-[10px] text-neutral-500 uppercase mb-1">Доступный остаток</div>
            <div className="text-xl font-semibold tabular-nums">{b.bal}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-600">
        Зачинка Open Banking API · реальные интеграции — на защите / следующей итерации
      </div>
    </div>
  );
}
