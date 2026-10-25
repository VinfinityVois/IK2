#!/usr/bin/env python3
from pathlib import Path
import argparse, shutil, sys

def replace_once(path, old, new, label):
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"[skip] {label}: already patched")
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}: {path}")
    backup = path.with_name(path.name + ".bak-ui-fix")
    if not backup.exists():
        shutil.copy2(path, backup)
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"[ok] {label}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    root = Path(parser.parse_args().repo).resolve()
    sidebar = root / "invoice-keeper/frontend/src/components/layout/sidebar.tsx"
    banks = root / "invoice-keeper/frontend/src/app/(dashboard)/banks/page.tsx"
    for f in (sidebar, banks):
        if not f.is_file():
            raise RuntimeError(f"File not found: {f}")

    replace_once(sidebar,
      '  const { user, logout } = useAuthStore();\n  const items = nav.filter((n) => !("admin" in n && n.admin) || user?.role === "admin");',
      '  const { user, logout, fetchMe } = useAuthStore();\n\n  useEffect(() => {\n    void fetchMe();\n  }, [fetchMe]);\n\n  const items = nav.filter((n) => !("admin" in n && n.admin) || user?.role === "admin");',
      "load user in sidebar")

    replace_once(banks,
      'import { useCallback, useEffect, useMemo, useState } from "react";',
      'import { useCallback, useEffect, useMemo, useState } from "react";\nimport { useRouter } from "next/navigation";',
      "import router")

    replace_once(banks,
      'export default function BanksPage() {\n  const [items, setItems] = useState<Occurrence[]>([]);',
      'export default function BanksPage() {\n  const router = useRouter();\n  const [demoCardIssued, setDemoCardIssued] = useState(false);\n  const [items, setItems] = useState<Occurrence[]>([]);',
      "add router and demo card state")

    old = '''      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      <header'''
    new = '''      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      {demoCardIssued && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="demo-card-title">
          <div className="w-full max-w-md rounded-2xl border border-blue-400/20 bg-[#111] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">DEMO ONLY</p>
                <h2 id="demo-card-title" className="mt-1 text-xl font-semibold text-white">Виртуальная демо-карта выпущена</h2>
              </div>
              <button type="button" onClick={() => setDemoCardIssued(false)} className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Закрыть">Закрыть</button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Invoice Keeper</span>
                <span className="rounded bg-white/15 px-2 py-1 text-[10px] font-bold tracking-widest text-white">DEMO</span>
              </div>
              <p className="my-8 font-mono text-xl tracking-[0.12em] text-white">•••• •••• •••• 4242</p>
              <div className="flex items-end justify-between text-xs text-blue-100">
                <div><p className="text-[10px] uppercase opacity-70">Держатель</p><p className="mt-1">DEMO USER</p></div>
                <div><p className="text-[10px] uppercase opacity-70">Срок</p><p className="mt-1">12/30</p></div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-5 text-amber-200">Это только визуальная тестовая карта. Она не является платёжным инструментом, не имеет настоящего PAN/CVC и не может использоваться для покупок.</p>
            <button type="button" onClick={() => setDemoCardIssued(false)} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Готово</button>
          </div>
        </div>
      )}

      <header'''
    replace_once(banks, old, new, "demo card dialog")

    replace_once(banks,
      '            onClick={() => setNotice(true)}\n            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"\n          >\n            <Landmark className="h-4 w-4 text-rose-400" />\n            + Подключить банк',
      '            onClick={() => router.push("/open-banking")}\n            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"\n          >\n            <Landmark className="h-4 w-4 text-rose-400" />\n            + Подключить банк',
      "connect bank navigates to Open Banking")

    replace_once(banks,
      '            onClick={() => showToast("Выпуск карт будет доступен после Open Banking")}',
      '            onClick={() => setDemoCardIssued(true)}',
      "issue demo card")
    print("Patch applied. Inspect with git diff and run npm run build.")

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        raise SystemExit(1)
