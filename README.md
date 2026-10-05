# Трекер портфеля по отчётам ВТБ

Личный кабинет, который строит дашборд портфеля из месячных отчётов ВТБ «Аналитика портфеля» (PDF или таблица `.xlsx` по шаблону). Ручного ввода с нуля нет: файл разбирается в браузере, на сервер уходят только распознанные числа, сам файл не хранится.

Что делает приложение, описано в [docs/TZ.md](docs/TZ.md). Кликабельный макет: [docs/preview.html](docs/preview.html).

Стек: Next.js (App Router), TypeScript, Postgres, Drizzle ORM, vitest, pdfjs-dist, read-excel-file.

## Запуск локально

Нужен Postgres.

```bash
npm install
cp .env.example .env.local   # задайте SESSION_SECRET и DATABASE_URL
npm run db:migrate           # создаёт таблицы
npm run dev
```

Открыть http://localhost:3000. Без входа все страницы ведут на `/login`, где можно создать аккаунт. `SESSION_SECRET`: `openssl rand -base64 48`.

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | dev-сервер |
| `npm run build` / `npm start` | сборка и запуск |
| `npm run lint` | ESLint |
| `npm run typecheck` | проверка типов |
| `npm test` | тесты: разбор PDF и таблицы на реальных отчётах, проверки, формулы, экран проверки, пароли |
| `DATABASE_URL_TEST=postgres://… npm test` | то же плюс тесты с настоящей базой: снимки, настройки, изоляция пользователей, ограничение перебора |
| `npm run e2e` | сквозная проверка в браузере (нужны запущенный сервер и файлы отчётов, см. `scripts/e2e.cjs`) |
| `npm run db:generate` / `db:migrate` | миграции |

## Как устроено

- `src/lib/report/` — разбор: `pdf-parse.ts` (по координатам текста PDF), `table-parse.ts` (шаблон `.xlsx`), `validate.ts` (проверки перед сохранением). Фикстуры в `fixtures/` — текст реальных отчётов с координатами, без номера счёта; сами PDF в репозитории не хранятся (`scripts/dump-pdf-items.mjs`).
- `src/lib/portfolio.ts` — формулы раздела 4 ТЗ (вложено своих, прибыль, XIRR, серия, аллокация), чистые функции.
- `src/lib/review-model.ts` — экран проверки: черновик ↔ данные для сервера.
- `src/lib/snapshots.ts`, `settings-save.ts` — сохранение; сервер заново проверяет всё, экрану не верит.
- Вход, регистрация, сессии, ограничение перебора — как в e-codo/invest.
- Деньги хранятся целыми копейками, на экране показываются целыми рублями (вниз).
