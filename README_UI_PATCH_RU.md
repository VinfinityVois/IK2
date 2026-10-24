# IK2 — UI/UX patch (тёмная тема)

Заменяются три страницы:
- `invoice-keeper/frontend/src/app/(dashboard)/banks/page.tsx`
- `invoice-keeper/frontend/src/app/(dashboard)/calendar/page.tsx`
- `invoice-keeper/frontend/src/app/(dashboard)/forecast/page.tsx`

Банки используют явно помеченные демо-остатки, которые не участвуют в расчётах. Календарь и прогноз используют существующий `getPaymentOccurrences()` и не создают фиктивных платежей. Прогноз показывает обязательства по срокам, а не остаток на банковском счёте.

Перед применением сделайте commit/копию проекта. Распакуйте архив в корень репозитория с сохранением путей. Затем из `invoice-keeper/frontend` запустите `npm run lint` и `npm run build`.

Бэкенд, схему SQLite, авторизацию и API не меняет. Open Banking API пока не подключён; кнопка подключения сообщает о статусе интеграции.
