# 0003. Template EJS, Layout, dan Lokasi Aset Statis

- **Status:** Diterima (Accepted)
- **Tanggal:** 21 Oktober 2026
- **Penulis:** Tim Pengembang Rencanaku.ai
- **Konteks tugas:** Perbaikan Fase 1 (Task ID: F1-FIX)

## Konteks

Fondasi Fase 1 memakai EJS sebagai view engine server-rendered. Implementasi
awal memakai `ejs@7.x` dan sintaks `<% layout(...) %>` / `<% block(...) %>`,
padahal EJS inti **tidak menyediakan** fitur layout tersebut. Akibatnya halaman
gagal dirender (`layout is not a function`) dan error handler ikut gagal saat
mencoba merender halaman error.

Selain itu terdapat dua masalah konsistensi:

1. Konfigurasi Tailwind berada di dua file (`tailwind.config.js` dan
   `tailwind.config.cjs`) yang keduanya tidak dipakai oleh build.
2. Lokasi aset tidak konsisten: build CSS menulis `public/assets/app.css`,
   layout merujuk `/assets/css/app.css`, sedangkan JavaScript berada di
   `src/public/assets/js/main.js` (di luar root statis `public/`).

## Opsi yang Dipertimbangkan

### A. Layout

1. **`express-ejs-layouts`** — menambah dependency runtime baru, tetapi memberi
   `res.render` dengan layout otomatis.
2. **Include partial manual** — memakai `<%- include(...) %>` bawaan EJS 3 untuk
   `partials/head.ejs` dan `partials/foot.ejs`, tanpa dependency tambahan.
3. **Sintaks `layout()`/`block()`** — tidak tersedia di EJS inti; ditolak.

### B. Lokasi aset statis

1. **`public/assets/` sebagai root statis** — build CSS menulis
   `public/assets/app.css`, JS di `public/assets/js/main.js`, di-mount pada
   `/assets`.
2. **`src/public/assets/css`** — sesuai sketsa awal ARCHITECTURE, tetapi
   mencampur aset publik dengan source dan membuat `src/` ikut tersaji.

## Keputusan

1. **EJS dikunci pada `ejs@3.1.x`** (ter-resolve `3.1.10`) sesuai baseline
   ARCHITECTURE §3.2. EJS 4+ tidak dipakai.
2. **Pendekatan layout: include partial manual.** Tidak ada dependency baru.
   - `src/views/partials/head.ejs` — doctype, `<head>`, header navigasi, dan
     pembuka `<main>`.
   - `src/views/partials/foot.ejs` — penutup `<main>`, footer, script, dan
     penutup dokumen.
   - Setiap halaman (`pages/index`, `errors/403`, `errors/404`, `errors/500`)
     meng-include kedua partial tersebut tepat satu kali sehingga header tidak
     terduplikasi.
3. **View root adalah `src/views`** (bukan `src/views/pages`), sehingga include
   relatif (`../partials/head`) konsisten.
4. **Lokasi aset statis tunggal: `public/assets/`**, di-mount pada `/assets`.
   - CSS hasil build: `public/assets/app.css` → URL `/assets/app.css`.
   - JavaScript: `public/assets/js/main.js` → URL `/assets/js/main.js`.
   - Direktori `src/public/` dihapus agar tidak ada salinan aset yang
     membingungkan.
5. **Tailwind v4 memakai konfigurasi CSS-first (`@theme` + `@source`)** di
   `src/styles/input.css`. Kedua file `tailwind.config.*` dihapus; `build:css`
   tidak bergantung pada file konfigurasi JavaScript.
6. **404 dan error handler** dipisah: `notFoundHandler` menangani 404 (HTML
   atau JSON sesuai `Accept`), sedangkan `createErrorHandler` menangani error
   lain. Keduanya tidak pernah mengirim stack trace ke klien; bila render
   gagal, respons jatuh ke teks polos yang aman.

## Konsekuensi

- Tidak ada dependency layout tambahan; semua template tetap EJS murni.
- Setiap halaman baru wajib meng-include `partials/head` dan `partials/foot`
  agar tampilan konsisten.
- Aset publik hanya boleh berada di `public/assets/`; jangan menaruh aset
  statis di `src/`.
- Perubahan token desain dilakukan di `src/styles/input.css` (`@theme`), lalu
  jalankan `npm run build:css`.
- Risiko: include manual lebih verbos dibanding layout otomatis; dampaknya
  kecil karena jumlah halaman masih sedikit pada Fase 1.

## Catatan dependensi (F1-FIX)

- `ejs` diturunkan dari `7.0.2` ke `3.1.10` (baseline ARCHITECTURE §3.2).
- `uuid` dihapus; penggantinya `crypto.randomUUID()` bawaan Node sehingga
  tidak perlu dependency tambahan.
- `winston` dipertahankan sebagai implementasi logger terstruktur + redaksi
  yang sudah dipakai `src/core/logger/index.js`; tidak ada dependency baru
  yang ditambahkan pada F1-FIX.

