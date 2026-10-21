# Rencanaku.ai

Aplikasi pendamping perencanaan proyek berbasis AI. Aplikasi membantu pengguna
mengembangkan ide menjadi rencana terstruktur, dokumen konteks proyek,
keputusan teknis, arsitektur, rencana implementasi, tugas, prompt coding agent,
serta siklus perbaikan prompt berdasarkan hasil dari coding agent eksternal.

**Status:** Fase 0–1 selesai (fondasi). Belum ada database, autentikasi, atau
fitur domain.

## Persyaratan

- Node.js `24.21.0` (lihat `.nvmrc` / `.node-version`)
- npm 11.x
- Build tools untuk `better-sqlite3` bila prebuilt binary tidak tersedia

## Mulai cepat

```bash
npm ci
cp .env.example .env          # lalu isi SESSION_SECRET & CSRF_SECRET
npm run build:css
npm start                     # http://localhost:3000
```

Hasilkan secret acak minimal 32 karakter:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm start` | Jalankan server (gagal cepat bila env tidak valid) |
| `npm run dev` | Jalankan server dengan watch |
| `npm run build:css` | Build Tailwind ke `public/assets/app.css` |
| `npm test` | Jalankan seluruh tes Vitest |
| `npm run test:unit` | Tes unit |
| `npm run test:integration` | Tes integrasi (supertest) |
| `npm run lint` | Syntax check entry point |
| `npm run check` | Lint + seluruh tes |
| `npm run doctor` | Diagnosis runtime, SQLite, dan repo |

## Struktur nyata saat ini

```text
.
├── .env.example            # template env, tanpa secret
├── .nvmrc / .node-version  # pin Node 24.21.0
├── docs/                   # PRD, ARCHITECTURE, implementation_plan, design, decisions/
├── public/assets/
│   ├── app.css             # hasil build Tailwind (committed)
│   └── js/main.js          # JS vanilla
├── scripts/doctor.js
├── src/
│   ├── app.js              # createApp() tanpa listen(), testable
│   ├── server.js           # listen + graceful shutdown + handler proses
│   ├── config/             # schema Zod + loader env (fail fast)
│   ├── core/logger/        # logger terstruktur + redaksi
│   ├── middleware/         # request-id, 404, error handler
│   ├── routes/             # health.js, pages.js
│   ├── styles/input.css    # token Tailwind v4 (@theme) + @source
│   └── views/
│       ├── partials/       # head.ejs, foot.ejs
│       ├── pages/index.ejs
│       └── errors/         # 403, 404, 500
└── test/
    ├── unit/               # config, startup, sanity
    ├── integration/        # app + endpoint
    ├── smoke/              # better-sqlite3
    └── helpers/            # env tes sintetis
```

Folder `src/modules/`, `src/db/`, `src/services/`, `src/providers/`, dan
`src/cli/` masih placeholder dari target arsitektur dan belum berisi kode.
Lihat `docs/decisions/` untuk keputusan teknis (runtime, ESM, EJS/aset).

## Endpoint

- `GET /` — halaman beranda
- `GET /health/live` — status proses
- `GET /health/ready` — kesiapan layanan

## Lisensi

ISC
