
from pathlib import Path
import argparse, shutil
p = argparse.ArgumentParser()
p.add_argument("--repo", default=".")
root = Path(p.parse_args().repo).resolve()
target = root / "invoice-keeper/frontend/src/app/(dashboard)/banks/page.tsx"
if not target.exists():
    target = root / "frontend/src/app/(dashboard)/banks/page.tsx"
if not target.exists():
    raise SystemExit(f"Не найден файл: {target}")
s = target.read_text(encoding="utf-8")
original = s

def sub(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(f"Фрагмент '{label}' найден {s.count(old)} раз вместо 1. Файл не изменён.")
    s = s.replace(old, new, 1)

sub('''  const [demoCardIssued, setDemoCardIssued] = useState(false);''',
'''  const [demoCardIssued, setDemoCardIssued] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCardCode, setShowCardCode] = useState(false);''', "state")
sub('''  useEffect(() => {
    void load();
  }, [load]);''',
'''  useEffect(() => {
    void load();
  }, [load]);

  // Keep issuance state, but never open a modal automatically on page mount.
  useEffect(() => {
    try {
      setDemoCardIssued(window.localStorage.getItem("ik_demo_card_issued") === "1");
    } catch {
      // Storage may be unavailable.
    }
  }, []);''', "load effect")
sub('''      {demoCardIssued && (
        <div className="fixed inset-0 z-[100]''',
'''      {showIssueModal && (
        <div className="fixed inset-0 z-[100]''', "modal condition")
sub('''<button type="button" onClick={() => setDemoCardIssued(false)} className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Закрыть">Закрыть</button>''',
'''<button type="button" onClick={() => setShowIssueModal(false)} className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Закрыть">Закрыть</button>''', "modal close")
sub('''            <p className="mt-4 text-sm leading-5 text-amber-200">Это только визуальная тестовая карта. Она не является платёжным инструментом, не имеет настоящего PAN/CVC и не может использоваться для покупок.</p>
            <button type="button" onClick={() => setDemoCardIssued(false)} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Готово</button>''',
'''            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-300">Тестовые реквизиты</span>
                <button type="button" onClick={() => setShowCardCode((v) => !v)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">
                  {showCardCode ? "Скрыть CVC" : "Показать CVC"}
                </button>
              </div>
              <p className="mt-2 font-mono text-neutral-200">4242 4242 4242 4242</p>
              <p className="mt-1 font-mono text-neutral-200">Срок: 12/30</p>
              {showCardCode && <p className="mt-1 font-mono text-neutral-200">CVC: 123 (тестовый)</p>}
            </div>
            <p className="mt-3 text-xs leading-5 text-amber-200">Это демонстрационные значения, не работающие для покупок.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void copyText("4242 4242 4242 4242", "Номер демо-карты")} className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/5">Копировать номер</button>
              <button type="button" onClick={() => setShowIssueModal(false)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Готово</button>
            </div>''', "modal details")
sub('''            onClick={() => setDemoCardIssued(true)}''',
'''            onClick={() => {
              setDemoCardIssued(true);
              setShowCardCode(false);
              setShowIssueModal(true);
              try { window.localStorage.setItem("ik_demo_card_issued", "1"); } catch { /* session-only fallback */ }
            }}''', "issue click")

start = '''          <div className="relative flex flex-col items-center">
            <div className="relative z-30 w-full overflow-hidden rounded-2xl bg-gradient-to-tr from-[#111315] via-[#1a1d20] to-[#262a2e] p-6 text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.45)]">'''
end = '''          </div>

          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">'''
if s.count(start) != 1 or s.count(end) != 1:
    raise SystemExit("Не найден ожидаемый блок витрины карт. Файл не изменён.")
a = s.index(start)
b = s.index(end, a)
replacement = r'''          <div className="relative h-[310px] w-full" aria-label="Витрина карт">
            {[
              { id: "signature", name: "AuraPay Signature", number: "•••• 8967", expiry: "08/29", holder: "DEMO USER", balance: "1 240 500.00 ₽", scheme: "VISA CORPORATE", gradient: "from-[#111315] via-[#1a1d20] to-[#343039]", accent: "bg-rose-500" },
              { id: "cloud", name: "Virtual Cloud & Dev", number: "•••• 4412", expiry: "11/29", holder: "DEMO USER", balance: "$2,480.00", scheme: "VIRTUAL · DEMO", gradient: "from-[#003c2d] via-[#006b4d] to-[#009568]", accent: "bg-emerald-400" },
              { id: "travel", name: "Travel & Hospitality VIP", number: "•••• 1092", expiry: "04/30", holder: "DEMO USER", balance: "350 000 ₽", scheme: "VISA · DEMO", gradient: "from-[#281044] via-[#482078] to-[#6b35a6]", accent: "bg-violet-400" },
            ].map((card, index) => {
              const offset = (index - cardIndex + 3) % 3;
              const active = offset === 0;
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-label={`Выбрать карту ${card.name}`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => setCardIndex(index)}
                  className={`absolute left-0 top-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${card.gradient} p-5 text-left text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.55)] transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    active ? "z-30 translate-x-0 translate-y-0 scale-100 opacity-100" :
                    offset === 1 ? "z-20 translate-x-3 translate-y-5 scale-[0.94] opacity-80 hover:translate-y-4" :
                    "z-10 -translate-x-3 translate-y-10 scale-[0.88] opacity-60 hover:translate-y-9"
                  }`}
                  style={{ minHeight: 245 }}
                >
                  <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.accent} text-sm font-bold text-white`}>
                        {card.id === "signature" ? "A" : card.id === "cloud" ? "</>" : "✦"}
                      </div>
                      <span className="truncate text-base font-bold tracking-tight">{card.name}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-white">
                      {active && freeze && card.id === "signature" ? "Заморожена" : "DEMO"}
                    </span>
                  </div>
                  <div className="relative z-10 my-5 flex items-center gap-3">
                    <div className="flex h-8 w-11 items-center justify-center rounded bg-gradient-to-br from-amber-300 to-amber-600 opacity-90"><div className="h-5 w-7 rounded-sm bg-black/20" /></div>
                    <span className="font-mono text-sm tracking-[0.16em]">{card.number}</span>
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Доступный остаток · демо</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight">{card.balance}</p>
                  </div>
                  <div className="relative z-10 mt-5 flex items-end justify-between gap-3 border-t border-white/15 pt-3">
                    <div className="min-w-0"><p className="text-[9px] uppercase tracking-wider text-white/50">Держатель</p><p className="mt-1 truncate text-xs font-semibold">{card.holder}</p></div>
                    <div className="text-center"><p className="text-[9px] uppercase tracking-wider text-white/50">Срок</p><p className="mt-1 text-xs font-medium tabular-nums">{card.expiry}</p></div>
                    <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-white/75">{card.scheme}</p></div>
                  </div>
                </button>
              );
            })}
          </div>'''
s = s[:a] + replacement + s[b:]

sub('''<h3 className="text-[15px] font-semibold text-white">Управление картой Signature</h3>''',
'''<h3 className="text-[15px] font-semibold text-white">{["Управление картой Signature", "Управление картой Cloud & Dev", "Управление картой Travel VIP"][cardIndex]}</h3>''', "management heading")
sub('''onClick={() => showToast("PIN/CVV недоступны в демо-режиме")}''',
'''onClick={() => { setShowCardCode((v) => !v); showToast(showCardCode ? "Тестовый CVC скрыт" : "Тестовый CVC: 123 (демо)"); }}''', "CVC action")
sub('''                Показать PIN/CVV''',
'''                {showCardCode ? "Скрыть PIN/CVV" : "Показать PIN/CVV"}''', "CVC label")

backup = target.with_suffix(target.suffix + ".bak-card-carousel")
shutil.copy2(target, backup)
target.write_text(s, encoding="utf-8")
print(f"Обновлён: {target}")
print(f"Резервная копия: {backup}")
