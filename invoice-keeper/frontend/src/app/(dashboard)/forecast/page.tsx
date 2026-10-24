"use client";

export default function ForecastPage() {
  return (
    <div className="w-full px-6 lg:px-10 py-8">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-widest text-violet-400 mb-1">
          AI Forecast · демо
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Прогноз и оптимизация кассовых разрывов
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Моделирование остатков и рекомендации по сдвигу дат платежей
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          ["Риск разрыва", "0.00%", "text-green-400"],
          ["Cash flow 30д", "+ —", "text-blue-400"],
          ["Резерв налоги", "—", ""],
          ["Smart Shift", "3 совета", "text-violet-400"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4">
            <div className="text-[10px] uppercase text-neutral-500">{l as string}</div>
            <div className={`text-xl font-semibold mt-1 ${c}`}>{v as string}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-6 mb-6 h-56 flex items-center justify-center text-neutral-600 text-sm">
        График динамики остатков · строится по payment-occurrences + summary API
      </div>

      <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-neutral-500">
        Рекомендации AI по сдвигу дат — зачинка. На защите можно показать ручной сценарий
        оптимизации на основе просроченных и ближайших сроков.
      </div>
    </div>
  );
}
