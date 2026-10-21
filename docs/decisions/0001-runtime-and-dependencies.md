# 0001. Runtime dan Penguncian Dependensi

- **Status:** Diterima (Accepted)
- **Tanggal:** 21 Oktober 2026
- **Penulis:** Tim Pengembang Rencanaku.ai

## Konteks

Rencanaku.ai membutuhkan fondasi runtime dan pustaka inti yang stabil, dapat direproduksi di berbagai lingkungan pengembangan (lokal, CI, server, dan Docker), serta aman sebelum fitur aplikasi mulai dibangun.

Pada saat inisiasi proyek (Oktober 2026):
1. Node.js 24 memasuki status Active LTS (dijadwalkan per 20 Oktober 2026).
2. Pustaka native database `better-sqlite3` telah mencapai versi 13.0.3 dengan dukungan penuh untuk Node.js 24 tanpa memerlukan kompilasi ulang manual bila prebuilt binary tersedia.
3. Dokumen inti (`PRD.md`, `ARCHITECTURE.md`, `implementation_plan.md`, `design.md`) ditempatkan pada subdirektori `docs/` daripada di root repositori untuk menjaga kerapian struktur proyek.

## Opsi yang Dipertimbangkan

1. **Node.js 22.x (Maintenance LTS):**
   - Kelebihan: Ekosistem sangat matang.
   - Kekurangan: Masa aktif akan berakhir lebih awal dibanding Node 24.
2. **Node.js 24.x (Active LTS):**
   - Kelebihan: Dukungan jangka panjang terbaru, performa runtime V8 lebih cepat, dukungan native tooling yang selaras dengan baseline Vitest 5 dan Express 5.
   - Kekurangan: Perlu verifikasi dukungan native binding `better-sqlite3`.

## Keputusan

1. **Runtime Node.js:**
   - Dikunci pada versi **Node.js 24.21.0**.
   - Dipin melalui `.nvmrc` dan `.node-version`.
   - Menggunakan npm bawaan dari runtime tersebut (`npm v11.19.0`).
2. **Manajemen Dependensi:**
   - `package-lock.json` dikeluarkan dari `.gitignore` dan **wajib di-commit** ke repositori.
   - Instalasi di CI/server wajib menggunakan `npm ci` untuk menjamin reproduktibilitas build.
3. **Penyimpanan Dokumen Spesifikasi:**
   - `PRD.md`, `ARCHITECTURE.md`, `implementation_plan.md`, dan dokumen desain diputuskan tetap berada di direktori `docs/` (bukan di root) sesuai arahan arsitektur, dan tidak dipindahkan tanpa persetujuan eksplisit.
4. **Matriks Platform Teruji Nyata:**
   - Platform yang telah lulus verifikasi smoke test langsung:
     - **OS:** Linux x86_64 (Ubuntu 22.04.1 LTS kernel 6.8.0-1064-azure).
     - **Runtime:** Node.js v24.21.0 / npm 11.19.0.
     - **Addon Native:** `better-sqlite3@13.0.3` (lulus uji baca-tulis disk dan in-memory).
     - **Test Runner:** `vitest@5.0.5` (lulus uji unit dan smoke test).

## Panduan Instalasi Runtime per OS

- **Linux (Ubuntu/Debian):**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  nvm install 24.21.0
  nvm use 24.21.0
  ```
- **macOS:**
  ```bash
  # Menggunakan fnm atau brew
  brew install fnm
  fnm install 24.21.0
  fnm use 24.21.0
  ```
- **Windows:**
  - Unduh nvm-windows dari GitHub releases, kemudian jalankan:
    ```cmd
    nvm install 24.21.0
    nvm use 24.21.0
    ```
  - Pastikan Visual C++ Build Tools terpasang jika prebuilt binary SQLite membutuhkan kompilasi lokal.

## Konsekuensi

- Pengembang dan pipeline CI harus menyamakan versi Node.js ke `24.21.0`.
- Perubahan dependensi tidak boleh dilakukan langsung via `npm install` acak, melainkan harus ditinjau dampaknya terhadap `package-lock.json` dan hasil `npm audit`.
- Temuan audit perihal paket transitif devDependency `@tailwindcss/cli -> @parcel/watcher -> micromatch -> braces` dicatat sebagai dependensi build time saja dan tidak memengaruhi runtime server produksi.
