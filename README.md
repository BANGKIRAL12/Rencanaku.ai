# Rencanaku.ai

Aplikasi pendamping perencanaan proyek berbasis AI. Aplikasi membantu pengguna mengembangkan ide menjadi rencana yang terstruktur, dokumen konteks proyek, keputusan teknis, arsitektur, rencana implementasi, tugas, prompt coding agent, serta siklus perbaikan prompt berdasarkan hasil dan kesalahan yang dilaporkan dari coding agent eksternal.

## Struktur Direktori

```
rencanaku-ai/
├── package.json
├── .env
├── .nvmrc
├── .node-version
├── .gitignore
├── AGENTS.md
├── README.md
├── docs/
│   ├── decisions/
│   ├── database/
│   ├── security/
│   ├── operations/
│   ├── testing/
│   └── api/
├── scripts/
│   ├── build-css.js
│   └── doctor.js
├── src/
│   ├── app.js
│   ├── server.js
│   ├── cli/
│   │   ├── index.js
│   │   └── commands/
│   ├── config/
│   │   ├── env.js
│   │   ├── schema.js
│   │   └── paths.js
│   ├── core/
│   │   ├── errors/
│   │   ├── logger/
│   │   ├── events/
│   │   ├── jobs/
│   │   ├── security/
│   │   └── utils/
│   ├── db/
│   │   ├── connection.js
│   │   ├── migrate.js
│   │   ├── migrations/
│   │   └── repositories/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── projects/
│   │   ├── conversations/
│   │   ├── attachments/
│   │   ├── memory/
│   │   ├── decisions/
│   │   ├── providers/
│   │   ├── ai-jobs/
│   │   ├── documents/
│   │   ├── plans/
│   │   ├── tasks/
│   │   ├── prompts/
│   │   ├── trials/
│   │   ├── notifications/
│   │   ├── search/
│   │   ├── storage/
│   │   ├── backups/
│   │   ├── diagnostics/
│   │   └── settings/
│   ├── middleware/
│   │   ├── auth-required.js
│   │   ├── csrf.js
│   │   ├── error-handler.js
│   │   ├── request-id.js
│   │   ├── rate-limit.js
│   │   └── validate.js
│   ├── providers/
│   │   ├── base/
│   │   ├── openai-compatible/
│   │   ├── anthropic/
│   │   ├── google/
│   │   └── custom/
│   ├── routes/
│   │   ├── web/
│   │   ├── api/
│   │   └── health.js
│   ├── services/
│   ├── views/
│   │   ├── layouts/
│   │   ├── partials/
│   │   ├── pages/
│   │   └── errors/
│   └── public/
│       ├── assets/
│       │   ├── css/
│       │   ├── js/
│       │   ├── icons/
│       │   └── fonts/
│       └── vendor/
├── styles/
│   └── input.css
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   ├── migrations/
│   ├── e2e-manual/
│   └── fixtures/
└── data/                         # dibuat runtime, tidak di-commit
    ├── app.sqlite
    ├── files/
    ├── projects/
    ├── backups/
    ├── logs/
    ├── temp/
    └── config/
        └── providers.json        # rahasia lokal, tidak disajikan web
```

## Fitur yang Telah Diterapkan (Fase 1)

1. **Struktur Modular Monolith** sesuai dengan spesifikasi ARKITEKTUR.md
2. **Konfigurasi Aplikasi** dengan validasi Zod
3. **Server Express** yang dapat di-test dengan Supertest
4. **Middleware** untuk:
   - Helmet (keamanan)
   - Request ID
   - Error Handler
5. **Routing** untuk health check endpoint
6. **View Engine** EJS dengan layout dan partials
7. **Tailwind CSS v4** dengan konfigurasi kustom
8. **JavaScript Vanilla** untuk interaksi frontend
9. **Tes** unit dan integrasi
10. **Build CSS** yang berjalan dengan benar

## Perintah Penting

- `npm start` — jalankan server
- `npm run dev` — jalankan server dengan hot reload
- `npm run build:css` — build Tailwind CSS
- `npm test` — jalankan semua tes
- `npm run doctor` — diagnose kesehatan aplikasi

## Persyaratan Sistem

- Node.js 24.x LTS (dikonfigurasi di `.nvmrc`)
- npm 11.x
- `better-sqlite3` (native addon)

## Lisensi

ISC