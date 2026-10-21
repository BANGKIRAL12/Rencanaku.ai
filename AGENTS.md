# AGENTS.md — Rencanaku.ai

AI-assisted project-planning app. Docs, UI, and product language are
**Bahasa Indonesia**; write user-facing strings/comments in Indonesian.
Product name is "Rencanaku.ai" (repo dir/package use `Rencanaku.ai`); the
app does **not** edit the code of target projects — it plans, prompts, and
tracks trials of external coding agents.

## Repo state (important)

This repo is at an early scaffolding stage (Phases 0–1). Phase 0 locked the
runtime and dependencies; Phase 1 added a bootable Express + EJS + Tailwind
foundation. There is still **no database, auth, or domain feature** — no
`db/` code, migrations, repository, session store, or project/task modules.

Current real state:

- `src/server.js` boots an Express app and handles graceful shutdown.
- `src/app.js` builds the app (no `listen()`) so tests can use `supertest`.
- `src/config/` validates env with Zod and exits with code 1 on invalid config.
- `src/middleware/` has request-id, 404, and error handlers.
- `src/routes/` has `/health/live`, `/health/ready`, and `/` only.
- `src/views/` has EJS pages for home, 403, 404, 500 plus partials.
- `public/assets/` is the single static root (built CSS + vanilla JS).
- `test/` has unit, integration, and smoke tests; `npm test` really runs them.
- `src/modules/`, `src/db/`, `src/services/`, `src/providers/`, `src/cli/` are
  empty placeholders from the target layout — do not assume they work.

Do not assume a file or script from `docs/*` is implemented — verify with
`ls`/git before relying on it. `opencode.jsonc` is gitignored (contains a
provider API key); never commit it or any secret. `.env` is gitignored;
`.env.example` is the committed template.

## Docs (all in Indonesian, authoritative)

- `docs/PRD.md` — product requirements; locked product decisions and scope boundaries are hard constraints.
- `docs/ARCHITECTURE.md` — the main technical spec: modular monolith, dependency rules, data model/migrations, AI provider adapter contract, security/backup invariants.
- `docs/implementation_plan.md` — phased build order: vertical slices, phase checkpoints/gates, acceptance criteria. Contains the "instructions for coding agents" contract (task format, test requirements, no-secrets rule, must-not-fake-tests rule) that every implementation task should follow.
- `docs/design.md` — dark-mode design tokens (colors, Tailwind classes, typography).
- `docs/decisions/` — ADRs. Read before changing runtime, module system, EJS layout, or asset paths.

Follow the PRD locked decisions and ARCHITECTURE invariants strictly
(owned project privacy, locked decisions requiring explicit approval,
built-in `crypto.scrypt` password hashing, session store in SQLite not
MemoryStore, CSRF/session auth, provider secrets never in logs/UI/export,
AI proposals require user approval, `done` task status only changed by
users).

## Stack & runtime

- Node.js, `"type": "module"` (ESM everywhere; no mixing `require`/`import`). Dikunci pada Node 24.x LTS (`.nvmrc` dan `.node-version` dipin ke `24.21.0`).
- Single process **modular monolith**: Express 5 + EJS 3 + `better-sqlite3` (SQLite, belum dipakai). No SPA/bundler; interaction via vanilla JS + Fetch. Tailwind v4 compiled locally (no CDN in prod).
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
- `npm run lint` — syntax check pada file entry point (`node --check src/server.js`).
- `npm run check` — menjalankan lint dan test bertahap.
- `npm run doctor` — skrip diagnosis kesehatan runtime Node, better-sqlite3, dan konfigurasi repo.
- `npm ci` — clean, reproducible install per lockfile (lockfile wajib di-commit).
- `npm ls --all` / `npm audit` — run before accepting dependency changes.

## Architecture rules (verify against ARCHITECTURE.md)

- Routes may call use cases but **never contain SQL**; only repositories query SQLite (prepared statements — never string-concatenate input into SQL).
- Each route must validate auth + ownership (using server-validated `userId`/`projectId`, not trusting browser IDs) + CSRF.
- Markdown/AI output is a *proposal* until user approves; diff review with accept/reject required; document versions + hash staleness checks (recompute diff if stale; no overwrite).
- AI provider adapters implement a common contract; providers cannot directly modify official documents/decisions.
- Long AI work goes through a persistent job queue (`ai_jobs`), not long HTTP requests; checkpoints/resume supported.
- Data (SQLite + files) lives in a private `data/` dir **outside** the public root (gitignored; `.env`, logs, backups also gitignored). Storage paths must resolve safely (no path traversal from user input).
- Every schema change = a testable migration; `PRAGMA foreign_keys = ON` per connection; optimistic concurrency on diffs; backup/restore must be tested and never mix old/new state.

## Testing quirks

- Test runner is Vitest 5 (`vitest.config.js`), tests under `test/` (unit / integration / smoke). `test/helpers/test-env.js` supplies a synthetic env; tests must **not** depend on the developer's `.env`.
- `src/config/env.js` skips loading `.env` when `NODE_ENV=test`, so config validation is deterministic in tests.
- `supertest` is used for HTTP endpoint tests. `createApp({ extraRoutes })` lets tests mount a throwing route before the 404/error handlers.
- `better-sqlite3` is a native addon — rely on prebuilt binaries matching the Node version and keep the smoke test green.
- Don't add dependencies without documented need + compatibility check; run `npm test` and `npm run build:css` before claiming done.
