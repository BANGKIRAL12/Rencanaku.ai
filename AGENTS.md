# AGENTS.md — Rencanaku.ai

AI-assisted project-planning app. Docs, UI, and product language are
**Bahasa Indonesia**; write user-facing strings/comments in Indonesian.
Product name is "Rencanaku.ai" (repo dir/package use `Rencanaku.ai`); the
app does **not** edit the code of target projects — it plans, prompts, and
tracks trials of external coding agents.

## Repo state (important)

This repo is at an early scaffolding stage (Phases 0–1). The **source of
truth is the docs, not the code**: `src/server.js` is an empty 0-byte
stub, `test/` is empty, and there are no routes/db/migrations/views yet.
Most "planned" modules in the docs do not exist. Do not assume a file or
script from `docs/*` is implemented — verify with `ls`/git before relying
on it. `opencode.jsonc` is gitignored (contains a provider API key);
never commit it or any secret.

## Docs (all in Indonesian, authoritative)

- `docs/PRD.md` — product requirements; locked product decisions and scope boundaries are hard constraints.
- `docs/ARCHITECTURE.md` — the main technical spec: modular monolith, dependency rules, data model/migrations, AI provider adapter contract, security/backup invariants.
- `docs/implementation_plan.md` — phased build order: vertical slices, phase checkpoints/gates, acceptance criteria. Contains the "instructions for coding agents" contract (task format, test requirements, no-secrets rule, must-not-fake-tests rule) that every implementation task should follow.
- `docs/design.md` — dark-mode design tokens (colors, Tailwind classes, typography).

Follow the PRD locked decisions and ARCHITECTURE invariants strictly
(owned project privacy, locked decisions requiring explicit approval,
built-in `crypto.scrypt` password hashing, session store in SQLite not
MemoryStore, CSRF/session auth, provider secrets never in logs/UI/export,
AI proposals require user approval, `done` task status only changed by
users).

## Stack & runtime

- Node.js, `"type": "module"` (ESM everywhere; no mixing `require`/`import`). Docs baseline Node 24 LTS (fallback 22.x); there is **no** `.nvmrc`/.node-version yet — create one and pin before adding runtime deps.
- Single process **modular monolith**: Express + `better-sqlite3` (SQLite) + EJS server-rendered views. No SPA/bundler; interaction via vanilla JS + Fetch. Tailwind v4 compiled locally (no CDN in prod).
- `marked` for Markdown — output **must be sanitized before injecting into DOM**; never treat user/AI content as trusted HTML.

## Commands

- `npm run dev` — start server with watch (hot reload). Current `src/server.js` is empty, so it boots nothing meaningful yet.
- `npm start` — production start.
- `npm run build:css` — build Tailwind: `npx @tailwindcss/cli -i ./src/styles/input.css -o ./public/assets/app.css`. Rebuild after touching `src/styles/input.css`; committed output lives in `public/assets/`.
- `npm test` — currently a broken placeholder (`echo ... && exit 1` then `&& vitest run`), so it always fails. **Do not report tests as passing**; use `npm run test:watch` (vitest) until tests are real, and run the actual failure to verify.
- `npm ci` — clean, reproducible install per lockfile (require lockfile committed).
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

- Test runner is Vitest 5; tests are organized under `test/` (unit / integration / security / etc. per implementation plan) but none exist yet.
- `supertest` available for HTTP endpoint tests; `better-sqlite3` is a native addon — rely on its prebuilt binaries matching the Node version and run a smoke test; Node 22 baseline requires Vitest≥22.12/Vite≥6.4.
- Don't add dependencies without documented need + compatibility check; run tests + build before claiming done.
