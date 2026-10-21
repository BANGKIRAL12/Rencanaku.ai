# 0002. Standar Sistem Modul (ECMAScript Modules)

- **Status:** Diterima (Accepted)
- **Tanggal:** 21 Oktober 2026
- **Penulis:** Tim Pengembang Rencanaku.ai

## Konteks

Node.js mendukung dua sistem modul: CommonJS (`require`/`module.exports`) dan ECMAScript Modules (`import`/`export`). Mencampur kedua sistem dalam satu codebase modular monolith Express sering memicu ambiguitas runtime, komplikasi tooling pengujian (Vitest/Jest), serta kendala impor pustaka modern yang hanya menyediakan format ESM murni.

## Opsi yang Dipertimbangkan

1. **CommonJS Murni:**
   - Kelebihan: Tradisional untuk Express.
   - Kekurangan: Banyak pustaka modern (seperti paket Vitest, Marked versi baru) mulai beralih ke ESM murni atau memerlukan interop rumit.
2. **Campuran CommonJS dan ESM:**
   - Kelebihan: Fleksibilitas semu.
   - Kekurangan: Menyebabkan overhead debugging, file `.cjs` vs `.mjs` yang membingungkan, dan rawan gagal pada runtime watch mode.
3. **ESM Murni (`"type": "module"`):**
   - Kelebihan: Standar resmi JavaScript modern, native di Node.js 22+, didukung langsung oleh Vitest 5 tanpa transpiler tambahan, dan sesuai spesifikasi ARCHITECTURE.md.
   - Kekurangan: Memerlukan penulisan ekstensi file secara eksplisit (misal `.js`) pada relative import, dan variabel global CJS seperti `__dirname` digantikan oleh pola `import.meta.url`.

## Keputusan

1. Seluruh codebase Rencanaku.ai dikunci menggunakan **ESM Murni** dengan mendeklarasikan `"type": "module"` di `package.json`.
2. Dilarang mencampur `require()` dan `import` dalam source code aplikasi maupun pengujian.
3. Seluruh impor internal (relative imports) wajib menyertakan ekstensi berkas secara eksplisit (contoh: `import { userRepo } from './repositories/user.repository.js'`).
4. Untuk utilitas path dan direktori, gunakan standar modern:
   ```javascript
   import { fileURLToPath } from 'node:url';
   import path from 'node:path';
   const __filename = fileURLToPath(import.meta.url);
   const __dirname = path.dirname(__filename);
   ```
5. Awalan skema protokol modul bawaan Node.js (`node:`) diwajibkan untuk semua dependensi core (contoh: `import fs from 'node:fs'`).

## Konsekuensi

- Pengujian dengan Vitest berjalan secara native tanpa wrapper loader CommonJS.
- Linter dan static syntax check (`node --check`) berjalan bersih tanpa transpiler eksternal.
- Kode tetap konsisten dan siap untuk integrasi packaging selanjutnya.
