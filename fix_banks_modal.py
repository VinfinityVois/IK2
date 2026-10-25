from pathlib import Path
import shutil

p = Path(r"invoice-keeper/frontend/src/app/(dashboard)/banks/page.tsx")
s = p.read_text(encoding="utf-8")
original = s

def replace_once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"ОТМЕНА: {label}: найдено {count} совпадений вместо 1. Файл не изменён.")
    s = s.replace(old, new, 1)

replace_once(
    'const [demoCardIssued, setDemoCardIssued] = useState(false);',
    'const [demoCardIssued, setDemoCardIssued] = useState(false);\n  const [showIssueModal, setShowIssueModal] = useState(false);',
    'состояние модального окна'
)

replace_once(
    '{demoCardIssued && (\n        <div className="fixed inset-0',
    '{showIssueModal && (\n        <div className="fixed inset-0',
    'условие показа модального окна'
)

replace_once(
    'onClick={() => setDemoCardIssued(false)}',
    'onClick={() => setShowIssueModal(false)}',
    'кнопка закрытия модального окна'
)

replace_once(
    'onClick={() => { setDemoCardIssued(false); setShowDemoSecurityCode(false); }}',
    'onClick={() => { setShowIssueModal(false); setShowDemoSecurityCode(false); }}',
    'кнопка Готово'
)

replace_once(
    'setDemoCardIssued(true);',
    'setDemoCardIssued(true);\n                setShowIssueModal(true);',
    'кнопка выпуска карты'
)

if s == original:
    raise SystemExit("Изменений нет; файл не записан.")

backup = p.with_suffix(".page.tsx.bak")
shutil.copy2(p, backup)
p.write_text(s, encoding="utf-8")
print(f"Готово. Изменён файл: {p}")
print(f"Резервная копия: {backup}")
