# AGENTS.md — Rencanaku.ai

AI-assisted project-planning app. Docs, UI, and product language are
**Bahasa Indonesia**; write user-facing strings/comments in Indonesian.
Product name is "Rencanaku.ai" (repo dir/package use `Rencanaku.ai`); the
app does **not** edit the code of target projects — it plans, prompts, and
tracks trials of external coding agents.

## Repo state (important)

Phases 0–2 are implemented. Phase 0 locked the runtime and dependencies;
Phase 1 added the Express + EJS + Tailwind foundation; Phase 2 added the
database, migrations, repositories, and private file storage. There is still
**no auth layer and no domain feature** (no login/session middleware wiring,
no projects/tasks UI or use cases). The database schema exists, but the app
does not yet read or write it from routes.

Current real state:

- `src/server.js` boots an Express app, opens the database on demand, and
  handles graceful shutdown.
- `src/app.js` builds the app (no `listen()`) so tests can use `supertest`;
  it fails fast if data paths are inside `public/`.
- `src/config/` validates env with Zod, resolves data paths
  (`src/config/paths.js`), and exits with code 1 on invalid config.
- `src/db/` works: `connection.js` (pragmas, singleton), `transaction.js`,
  `migrate.js` (runner + checksums), `migrations/001_initial_schema.sql`,
  `migrations/002_stored_files.sql`, `repositories/` (all SQL lives here),
  and `container.js` (migrate → create repositories).
- `src/modules/storage/` works: `data-directory.js`, `file-storage.js`
  (atomic writes, checksums, ownership), `storage-integrity.js`.
- `src/middleware/` has request-id, 404, and error handlers.
- `src/routes/` has `/health/live`, `/health/ready`, and `/` only.
- `src/views/` has EJS pages for home, 403, 404, 500 plus partials.
- `public/assets/` is the single static root (built CSS + vanilla JS).
- `test/` has unit, integration, and smoke tests; `npm test` really runs them.
- `src/services/`, `src/providers/`, `src/cli/` are still empty placeholders
  from the target layout — do not assume they work.

Schema and storage decisions are documented in `docs/database/schema.md` and
ADRs 0004 (WAL + backup) and 0005 (data dir + file storage).

Do not assume a file or script from `docs/*` is implemented — verify with
`ls`/git before relying on it. `opencode.jsonc` is gitignored (contains a
provider API key); never commit it or any secret. `.env` is gitignored;
`.env.example` is the committed template. `data/` is gitignored.

## Docs (all in Indonesian, authoritative)

- `docs/PRD.md` — product requirements; locked product decisions and scope boundaries are hard constraints.
- `docs/ARCHITECTURE.md` — the main technical spec: modular monolith, dependency rules, data model/migrations, AI provider adapter contract, security/backup invariants.
- `docs/implementation_plan.md` — phased build order: vertical slices, phase checkpoints/gates, acceptance criteria. Contains the "instructions for coding agents" contract (task format, test requirements, no-secrets rule, must-not-fake-tests rule) that every implementation task should follow.
- `docs/design.md` — dark-mode design tokens (colors, Tailwind classes, typography).
- `docs/database/schema.md` — tabel, indeks, invarian, dan prosedur menambah migrasi.
- `docs/decisions/` — ADRs. Read before changing runtime, module system, EJS layout, asset paths, journal mode/backup (0004), or data dir/file storage (0005).

Follow the PRD locked decisions and ARCHITECTURE invariants strictly
(owned project privacy, locked decisions requiring explicit approval,
built-in `crypto.scrypt` password hashing, session store in SQLite not
MemoryStore, CSRF/session auth, provider secrets never in logs/UI/export,
AI proposals require user approval, `done` task status only changed by
users).

## Stack & runtime

- Node.js, `"type": "module"` (ESM everywhere; no mixing `require`/`import`). Dikunci pada Node 24.x LTS (`.nvmrc` dan `.node-version` dipin ke `24.21.0`).
- Single process **modular monolith**: Express 5 + EJS 3 + `better-sqlite3` (SQLite dengan migrasi dan repository). No SPA/bundler; interaction via vanilla JS + Fetch. Tailwind v4 compiled locally (no CDN in prod).
- `package-lock.json` telah di-track oleh git (dihapus dari `.gitignore`); instalasi CI/server menggunakan `npm ci`.
- EJS memakai **include partial manual** (`src/views/partials/head.ejs` + `foot.ejs`), bukan `express-ejs-layouts`; jangan memakai `<% layout() %>` (lihat ADR 0003).
- Aset statis hanya di `public/assets/`: CSS hasil build `public/assets/app.css` → `/assets/app.css`, JS `public/assets/js/main.js` → `/assets/js/main.js`. Jangan menaruh aset publik di `src/`.
- Tailwind v4 bersifat CSS-first: token di `@theme` dan pemindaian di `@source` dalam `src/styles/input.css`; tidak ada `tailwind.config.*`.
- `marked` untuk Markdown — output **must be sanitized before injecting into DOM**; never treat user/AI content as trusted HTML.

## Commands

- `npm run dev` — start server with watch (hot reload).
- `npm start` — production start (fails fast with exit 1 on invalid env).
- `npm run build:css` — build Tailwind: `npx @tailwindcss/cli -i ./src/styles/input.css -o ./public/assets/app.css`. Rebuild after touching `src/styles/input.css` or view classes; output is committed.
- `npm test` — menjalankan seluruh rangkaian tes dengan `vitest run`.
- `npm run test:watch` — mode watch pengujian menggunakan Vitest.
- `npm run test:unit` — menjalankan tes unit di `test/unit`.
- `npm run test:integration` — menjalankan tes integrasi di `test/integration`.
- `npm run lint` — `node --check` pada lima entry point (`src/server.js`, `src/app.js`, dan tiga skrip di `scripts/`).
- `npm run check` — menjalankan lint dan test bertahap.
- `npm run db:migrate` — menerapkan migrasi yang tertunda ke `DATA_DIR/app.sqlite`.
- `npm run db:check` — pemeriksaan integritas: `PRAGMA integrity_check`, foreign key, status migrasi, checksum file, file yatim, izin direktori. Exit 1 bila ada `fail`.
- `npm run doctor` — skrip diagnosis kesehatan runtime Node, better-sqlite3, konfigurasi repo, dan path data.
- `npm ci` — clean, reproducible install per lockfile (lockfile wajib di-commit).
- `npm ls --all` / `npm audit` — run before accepting dependency changes.

## Architecture rules (verify against ARCHITECTURE.md)

- Routes may call use cases but **never contain SQL**; only repositories query SQLite (prepared statements — never string-concatenate input into SQL).
- Each route must validate auth + ownership (using server-validated `userId`/`projectId`, not trusting browser IDs) + CSRF.
- Markdown/AI output is a *proposal* until user approves; diff review with accept/reject required; document versions + hash staleness checks (recompute diff if stale; no overwrite).
- AI provider adapters implement a common contract; providers cannot directly modify official documents/decisions.
- Long AI work goes through a persistent job queue (`ai_jobs`), not long HTTP requests; checkpoints/resume supported.
- Data (SQLite + files) lives in a private `DATA_DIR` (default `data/`) **outside** the public root (gitignored; `.env`, logs, backups also gitignored). Storage paths must resolve safely (no path traversal from user input); use `src/core/utils/safe-path.js`, never string-join user input into a path.
- Every schema change = a testable migration (works from empty DB and from the previous version); never edit an already-released migration — add a new one and bump `SUPPORTED_SCHEMA_VERSION`. `PRAGMA foreign_keys = ON` per connection; optimistic concurrency on diffs; backup/restore must be tested and never mix old/new state.
- Never create an `active` `stored_files` row that points at a missing file. Order: write temp → fsync → atomic rename → INSERT, with unlink compensation. Delete: mark row `deleted` first, then unlink bytes.
- `app_settings` and `audit_events` must never hold secrets (provider API keys live only in `data/config/providers.json`). Repositories reject secret-like settings/metadata.

## Testing quirks

- Test runner is Vitest 5 (`vitest.config.js`), tests under `test/` (unit / integration / smoke). `test/helpers/test-env.js` supplies a synthetic env; tests must **not** depend on the developer's `.env`.
- `src/config/env.js` skips loading `.env` when `NODE_ENV=test`, so config validation is deterministic in tests. `vitest.config.js` injects the synthetic env **before any module import** because config, logger, and the DB layer validate at import time.
- Database tests use `createTestWorkspace()` from `test/helpers/data.js`: a temp `DATA_DIR` under `/tmp/opencode`, migrated DB, repositories, and file storage. Always call `cleanup()`. Pass `{ migrate: false }` only when testing the runner itself (then `repositories`/`fileStorage` are `null`).
- The full repository bundle can only be created at the latest schema version (prepared statements are built eagerly). Run migrations first, then `createRepositories(db)`.
- `better-sqlite3` error codes are not always intuitive: a RESTRICT foreign key reports `SQLITE_CONSTRAINT_TRIGGER`. Repository error mapping also inspects the SQLite message.
- `supertest` is used for HTTP endpoint tests. `createApp({ extraRoutes })` lets tests mount a throwing route before the 404/error handlers.
- `better-sqlite3` is a native addon — rely on prebuilt binaries matching the Node version and keep the smoke test green.
- Don't add dependencies without documented need + compatibility check; run `npm test`, `npm run build:css`, `npm run db:check`, and `npm run doctor` before claiming done.
