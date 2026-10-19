# ARCHITECTURE.md --- Rencanaku.ai

**Versi dokumen:** 1.0\
**Status:** Baseline arsitektur teknis untuk implementasi\
**Tanggal pemeriksaan dependensi:** 19 Oktober 2026\
**Sumber kebutuhan:** `PRD.md` Rencanaku.ai\
**Prinsip:** modular monolith, server-rendered, secure-by-default,
recoverable workflows, dan keputusan produk tidak boleh berubah
diam-diam.

> Dokumen ini menerjemahkan kebutuhan PRD menjadi rancangan teknis.
> Keputusan yang secara eksplisit telah disepakati dalam PRD
> diperlakukan sebagai batas tetap. Detail implementasi yang belum
> dikunci di sini merupakan rekomendasi arsitektur yang harus
> diverifikasi lewat instalasi bersih, pengujian, dan lockfile sebelum
> rilis.

## 1. Ringkasan arsitektur

Rencanaku.ai adalah aplikasi web perencanaan proyek berbantuan AI.
Aplikasi membantu pengguna mengembangkan gagasan, mengelola konteks,
membuat dokumen perencanaan, menyusun rencana implementasi, membentuk
prompt untuk coding agent eksternal, serta menelusuri percobaan dan
perbaikan prompt. Aplikasi tidak menjalankan peran sebagai editor
langsung source code proyek target.

Arsitektur menggunakan **satu codebase modular monolith**. Modul
dipisahkan secara logis di dalam satu proses aplikasi dan satu
repositori. Modul tidak dipisahkan menjadi microservices. Antarmuka
memakai HTML server-rendered dengan EJS, CSS Tailwind yang dikompilasi
secara lokal, dan JavaScript vanilla untuk interaksi yang membutuhkan
Fetch API. SQLite menyimpan metadata dan relasi; sistem berkas menyimpan
dokumen, lampiran, dan backup.

### 1.1 Diagram konteks

``` mermaid
flowchart LR
    U[Pengguna / Admin] --> B[Browser]
    B -->|HTTPS / HTTP lokal| APP[Express Application]
    APP --> AUTH[Autentikasi & Otorisasi]
    APP --> UI[EJS Views + Static Assets]
    APP --> CORE[Modul Domain]
    CORE --> DB[(SQLite)]
    CORE --> FS[(Data Directory)]
    CORE --> JOBS[Job Queue Lokal]
    JOBS --> AI[AI Provider Adapter]
    AI --> P[Provider AI / Gateway]
    APP --> CLI[CLI Operasional]
    CLI --> DB
    CLI --> FS
    CLI --> APP
```

### 1.2 Sasaran arsitektur

-   Menjaga pemisahan tanggung jawab tanpa overhead layanan
    terdistribusi.
-   Mendukung penggunaan pribadi dan multi-pengguna melalui server.
-   Memungkinkan penyimpanan lokal, deployment server, serta Docker
    dengan volume persisten.
-   Memastikan data privat setiap anggota tidak terlihat oleh anggota
    lain.
-   Memisahkan riwayat percakapan dari memori proyek terstruktur.
-   Memastikan perubahan dokumen, rencana, prompt, dan keputusan dapat
    ditinjau, divalidasi, dan dilacak.
-   Memastikan operasi berisiko---migrasi, restore, penghapusan
    permanen, perubahan keputusan terkunci---memerlukan kontrol
    eksplisit.
-   Memungkinkan provider AI diganti tanpa mengubah domain utama.
-   Menghasilkan diagnosis yang dapat ditindaklanjuti tanpa membocorkan
    rahasia.

## 2. Batas produk dan prinsip domain

### 2.1 Di dalam ruang lingkup

-   Dashboard, proyek, percakapan, lampiran, pencarian metadata,
    notifikasi, pengaturan, dan administrasi.
-   Konfigurasi provider/model AI serta pemilihan model per jenis
    pekerjaan.
-   Memori proyek, keputusan, dokumen konteks, rencana implementasi,
    tugas, prompt, percobaan coding agent, validasi, dan penutupan
    proyek.
-   Penyuntingan dokumen melalui proposal/diff dan persetujuan pengguna.
-   Backup, restore, retensi, trash, pemantauan penyimpanan, diagnosis,
    CLI, Docker, dan prosedur pembaruan manual.

### 2.2 Di luar ruang lingkup

-   Menulis atau mengedit langsung source code proyek target.
-   Menjalankan source code yang diunggah.
-   Mengimpor paket proyek portabel sebagai fitur produk standar.
-   Membuat pendaftaran publik terbuka secara default.
-   Membiarkan AI menandai tugas selesai atau menutup proyek tanpa
    keputusan pengguna.
-   Mengubah keputusan yang disetujui secara diam-diam.
-   Memperlakukan rekomendasi model eksternal sebagai model yang sedang
    menjalankan Rencanaku.ai.

### 2.3 Invarian domain

1.  Proyek privat hanya dapat diakses pemiliknya, kecuali fitur berbagi
    kelak disetujui sebagai perubahan produk tersendiri.
2.  Admin dapat mengelola akun dan sistem, tetapi tidak memperoleh akses
    otomatis ke isi proyek privat.
3.  Keputusan terkunci hanya berubah melalui persetujuan eksplisit.
4.  Perubahan dokumen yang dihasilkan AI adalah proposal sampai
    disetujui.
5.  Status tugas `done` hanya dapat diubah pengguna.
6.  Rencana harus disetujui sebelum prompt tugas resmi dibuat.
7.  Setiap prompt revisi dan laporan hasil tetap terhubung ke tugas dan
    prompt asal.
8.  Kegagalan suatu tahap menghentikan tahap dependen; hasil tahap yang
    berhasil disimpan agar tidak perlu diulang tanpa alasan.
9.  Data file dan metadata database harus konsisten setelah backup,
    restore, dan pemulihan.
10. Aplikasi tidak boleh mengklaim tes atau validasi telah dilakukan
    jika tidak benar-benar dijalankan.

## 3. Baseline teknologi dan kompatibilitas

### 3.1 Runtime

  -----------------------------------------------------------------------
  Komponen                Baseline yang           Peran dan aturan
                          direkomendasikan        
  ----------------------- ----------------------- -----------------------
  Node.js                 **Node.js 24.x LTS**    Samakan versi mayor
                          untuk baseline          pada pengembangan, CI,
                          implementasi setelah    Docker, dan rilis.
                          status Active LTS       Jangan targetkan
                          berlaku; jika           Node.js 12.
                          lingkungan build belum  
                          menyediakan 24 LTS,     
                          gunakan Node.js 22.x    
                          yang masih didukung     
                          sementara               

  npm                     Versi yang              Commit
                          didistribusikan bersama `package-lock.json`;
                          runtime Node yang       gunakan `npm ci` di CI
                          dipilih                 dan rilis.

  JavaScript              ESM                     Gunakan satu sistem
                          (`"type": "module"`)    modul secara konsisten.
                                                  Hindari campuran
                                                  `require()` dan
                                                  `import` kecuali pada
                                                  batas kompatibilitas
                                                  yang terdokumentasi.

  Browser                 Browser modern yang     Tidak memerlukan
                          mendukung HTML5, Fetch  bundler SPA. Kode
                          API, ES modules, dan    editor dapat dibundel
                          fitur aksesibilitas     sebagai aset lokal.
                          standar                 
  -----------------------------------------------------------------------

**Alasan runtime:** Node.js 24 dijadwalkan memasuki Active LTS pada 20
Oktober 2026; tanggal tersebut satu hari setelah tanggal pemeriksaan
dokumen. Karena itu, verifikasi status rilis sebelum menetapkan runtime
produksi. Node.js 22 masih berada dalam jalur Maintenance LTS hingga
2027-04-30. Vitest 5 mensyaratkan Node.js ≥22.12 dan Vite ≥6.4,
sedangkan Express 5 memerlukan Node.js ≥18. `better-sqlite3` versi 12.x
mendukung versi Node yang masih didukung termasuk 22 dan 24. Sumber:
[jadwal rilis
Node.js](https://github.com/nodejs/Release/blob/main/README.md),
[Express 5 migration
guide](https://expressjs.com/en/guide/migrating-5/), [Vitest migration
guide](https://vitest.dev/guide/migration/), [better-sqlite3
package](https://www.npmjs.com/package/better-sqlite3).

### 3.2 Dependensi runtime

Gunakan baseline major berikut sebagai **rentang kompatibilitas yang
harus dikunci oleh `package-lock.json`**, bukan izin untuk memperbarui
otomatis tanpa tes.

  --------------------------------------------------------------------------------------
  Paket                         Baseline versi Kategori              Catatan
                                                                     kompatibilitas
  ---------------------- --------------------- --------------------- -------------------
  `express`                            `5.1.x` Runtime               API routing HTTP.
                                                                     Uji perilaku
                                                                     middleware dan
                                                                     error handler
                                                                     terhadap Express 5.

  `ejs`                                `3.1.x` Runtime               Template
                                                                     server-rendered;
                                                                     jangan memasukkan
                                                                     konten pengguna
                                                                     sebagai template
                                                                     EJS yang
                                                                     dieksekusi.

  `better-sqlite3`                   `12.10.x` Runtime/native addon  Gunakan versi yang
                                                                     memiliki
                                                                     binary/prebuild
                                                                     cocok dengan
                                                                     runtime dan OS
                                                                     target. Jalankan
                                                                     smoke test pada
                                                                     Windows/Linux dan
                                                                     arsitektur yang
                                                                     didukung.

  `zod`                                  `4.x` Runtime               Validasi
                                                                     konfigurasi, input,
                                                                     dan struktur
                                                                     keluaran AI. Jangan
                                                                     mengasumsikan API
                                                                     Zod 3 sama dengan
                                                                     Zod 4.

  `commander`                           `14.x` Runtime CLI           CLI operasional;
                                                                     pastikan versi
                                                                     final mendukung
                                                                     runtime yang
                                                                     dikunci.

  `marked`                            `18.1.x` Runtime               Parser Markdown.
                                                                     Output wajib
                                                                     disanitasi sebelum
                                                                     dimasukkan ke DOM.

  `multer`                               `2.x` Runtime               Multipart upload;
                                                                     batas ukuran,
                                                                     jumlah file, dan
                                                                     tipe file harus
                                                                     eksplisit.

  `helmet`                               `8.x` Runtime               Header keamanan;
                                                                     CSP harus
                                                                     disesuaikan dengan
                                                                     aset lokal dan
                                                                     editor.

  `express-session`                   `1.18.x` Runtime               Manajemen sesi.
                                                                     Jangan gunakan
                                                                     MemoryStore untuk
                                                                     deployment server
                                                                     produksi.

  `express-rate-limit`                   `8.x` Runtime               Pembatasan request,
                                                                     terutama login dan
                                                                     endpoint AI.
                                                                     Verifikasi API
                                                                     versi yang dikunci.

  `csrf-sync`                            `4.x` Runtime, bila         Proteksi CSRF untuk
                                               kompatibel pada saat  form dan request
                                               instalasi             mutasi berbasis
                                                                     sesi. Jika
                                                                     kompatibilitas
                                                                     aktual tidak lolos
                                                                     tes, gunakan
                                                                     implementasi token
                                                                     CSRF yang
                                                                     terpelihara dan
                                                                     didokumentasikan;
                                                                     jangan menghapus
                                                                     proteksi.

  `archiver`                             `7.x` Runtime/operasional   Pembuatan arsip
                                                                     backup internal.
                                                                     Tidak berarti fitur
                                                                     impor proyek
                                                                     portabel
                                                                     diaktifkan.
  --------------------------------------------------------------------------------------

Versi patch/minor tepat ditetapkan melalui registry saat instalasi
pertama, lalu dibekukan dalam `package-lock.json`. Jangan mencantumkan
angka patch yang belum di-resolve sebagai angka yang telah diuji.

### 3.3 Dependensi frontend

  --------------------------------------------------------------------------------
  Paket                           Baseline versi Kategori         Catatan
  ------------------------ --------------------- ---------------- ----------------
  `tailwindcss`                          `4.3.x` Build            Menghasilkan CSS
                                                                  statis; tidak
                                                                  memakai Play CDN
                                                                  pada produksi.

  `@tailwindcss/cli`                     `4.3.x` Build            Harus memakai
                                                                  jalur versi yang
                                                                  sama dengan
                                                                  `tailwindcss`.
                                                                  CLI Tailwind v4
                                                                  merupakan paket
                                                                  terpisah.

  `codemirror`                           `6.0.x` Runtime frontend Editor modular
                                                                  untuk teks/kode.

  `@codemirror/state`                      `6.x` Runtime frontend State editor.

  `@codemirror/view`                       `6.x` Runtime frontend DOM view editor.

  `@codemirror/commands`                   `6.x` Runtime frontend Perintah editing
                                                 opsional         yang diperlukan.

  `@codemirror/language`                   `6.x` Runtime frontend Fitur
                                                 opsional         bahasa/editor
                                                                  bila diperlukan.

  `dompurify`                              `3.x` Runtime frontend Sanitasi HTML
                                                                  hasil render
                                                                  Markdown sebelum
                                                                  memasukkan HTML
                                                                  ke DOM.
  --------------------------------------------------------------------------------

Paket CodeMirror saling terhubung melalui dependensi antar-paket.
Biarkan npm menyelesaikan dependensi transitive dan audit tree; jangan
memaksa versi berbeda melalui overrides tanpa bukti konflik yang jelas.
Tailwind CSS v4 CLI dipasang dengan `tailwindcss` dan
`@tailwindcss/cli`, lalu dijalankan terhadap file CSS sumber dan
direktori template. Sumber: [Tailwind CLI
installation](https://tailwindcss.com/docs/installation/tailwind-cli),
[CodeMirror package](https://www.npmjs.com/package/%40codemirror/view).

### 3.4 Dependensi pengembangan dan pengujian

  --------------------------------------------------------------------------
  Paket                                 Baseline versi Kegunaan
  ----------------------- ---------------------------- ---------------------
  `vitest`                                       `5.x` Unit, integration,
                                                       dan regression tests.

  `vite`                            `6.4.x` atau versi Dipasang sebagai
                              kompatibel yang memenuhi dependency eksplisit
                                  persyaratan Vitest 5 jika diperlukan oleh
                                                       setup Vitest; bukan
                                                       bundler aplikasi
                                                       utama.

  `supertest`                                    `7.x` Pengujian endpoint
                                                       Express melalui HTTP.

  `@vitest/coverage-v8`       `5.x`, sama major dengan Coverage jika
                                                Vitest diaktifkan.

  `eslint`                         `9.x` atau baseline Linting.
                           kompatibel yang dipilih tim 

  `@eslint/js`                  major yang sama dengan Konfigurasi linting
                                                ESLint JavaScript.
  --------------------------------------------------------------------------

Vitest dan Vite adalah alat pengembangan/pengujian; keberadaannya tidak
mengubah aplikasi menjadi SPA. Vitest 5 memerlukan Node.js ≥22.12 dan
Vite ≥6.4. Gunakan versi yang benar-benar ter-resolve dan uji melalui
`npm ci`. Sumber: [Vitest guide](https://vitest.dev/guide/), [Vitest
migration guide](https://vitest.dev/guide/migration/).

### 3.5 Aturan mengunci dependensi

1.  Gunakan versi Node.js yang sama pada workstation, CI, dan Docker.
2.  Tambahkan dependensi dengan `npm install --save-exact` ketika tim
    ingin mengunci versi langsung; commit `package.json` dan
    `package-lock.json`.
3.  CI dan deployment menggunakan `npm ci`, bukan `npm install` tanpa
    lockfile.
4.  Jalankan `npm ls --all`, `npm audit`, unit test, integration test,
    smoke test database, dan build CSS sebelum menerima perubahan
    dependensi.
5.  Jangan memakai `overrides` untuk menyembunyikan konflik peer
    dependency tanpa analisis dan tes regresi.
6.  Perubahan major dependency harus berupa perubahan terpisah dengan
    catatan dampak, hasil tes, dan rencana rollback.
7.  Uji instalasi bersih pada sistem operasi yang masuk matriks
    dukungan.
8.  Untuk `better-sqlite3`, verifikasi prebuilt binary untuk kombinasi
    Node/OS/arsitektur; jika binary tidak tersedia, kegagalan build
    native harus ditangani sebagai masalah lingkungan yang nyata, bukan
    dilewati.
9.  Hindari `latest` dalam Dockerfile produksi. Kunci versi image Node,
    idealnya juga digest image ketika rilis.
10. Lakukan pembaruan dependency terjadwal, bukan otomatis di server
    produksi.

## 4. Struktur repositori

Struktur berikut adalah target modular monolith. Nama file dapat
berkembang jika diperlukan, tetapi tanggung jawab modul harus tetap
konsisten.

``` text
rencanaku-ai/
├── package.json
├── package-lock.json
├── .nvmrc
├── .node-version
├── .gitignore
├── .dockerignore
├── .env.example
├── Dockerfile
├── compose.yaml
├── README.md
├── PRD.md
├── ARCHITECTURE.md
├── implementation_plan.md
├── docs/
│   ├── decisions/
│   ├── database/
│   ├── security/
│   ├── operations/
│   ├── testing/
│   └── api/
├── scripts/
│   ├── build-css.js
│   ├── check-config.js
│   └── release-check.js
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

### 4.1 Batas tanggung jawab folder

-   `modules/`: use case/domain per fitur. Modul tidak mengakses tabel
    modul lain secara langsung tanpa repository/service contract.
-   `db/repositories/`: query SQLite, transaksi, dan mapping record.
-   `providers/`: komunikasi spesifik API AI. Tidak boleh memuat aturan
    bisnis proyek.
-   `services/`: orkestrasi lintas modul yang tidak cocok dimiliki satu
    domain.
-   `routes/`: validasi request, pemanggilan use case, dan pemilihan
    response; bukan tempat menaruh logika bisnis panjang.
-   `views/`: template EJS. Data yang berasal dari pengguna harus
    di-escape; jangan menggunakan `<%-` untuk teks tak tepercaya tanpa
    sanitasi yang sesuai.
-   `public/`: hanya aset yang memang aman dipublikasikan kepada
    browser.
-   `data/`: file runtime privat, di luar public root dan idealnya di
    luar direktori repositori.
-   `cli/`: perintah operasional yang memanggil service yang sama dengan
    web, bukan menyalin logika bisnis.
-   `tests/`: pengujian diatur menurut jenisnya, dengan fixture sintetis
    tanpa rahasia.

## 5. Lapisan aplikasi dan aturan dependensi

``` mermaid
flowchart TB
    ROUTES[Routes / Controllers] --> USE[Use Cases / Application Services]
    USE --> DOMAIN[Domain Rules]
    USE --> REPO[Repository Interfaces]
    USE --> AI[AI Orchestrator]
    REPO --> SQLITE[(SQLite Repositories)]
    USE --> FILES[File Storage Service]
    AI --> ADAPTER[Provider Adapters]
    ADAPTER --> EXT[External AI APIs]
    ROUTES --> VIEWS[EJS Views]
```

### 5.1 Aturan dependensi

1.  Routes boleh memanggil use case, tetapi tidak mengandung SQL.
2.  Domain tidak mengimpor Express, EJS, atau provider SDK.
3.  Repository adalah satu-satunya modul yang menyusun query SQL.
4.  AI adapter mengubah permintaan internal menjadi request provider dan
    respons provider menjadi format internal.
5.  Provider tidak boleh mengubah dokumen/keputusan resmi secara
    langsung; output masuk ke validator dan alur proposal.
6.  Semua akses proyek memakai `userId` dan `projectId` yang tervalidasi
    pada server. Jangan mempercayai ID yang dikirim browser sebagai
    bukti kepemilikan.
7.  File storage menerima identifier internal, bukan path arbitrer dari
    request.
8.  CLI menggunakan service yang sama dengan aplikasi web.
9.  Job panjang berjalan melalui job runner lokal dengan status yang
    tersimpan, bukan request HTTP panjang yang kehilangan status ketika
    browser ditutup.
10. Setiap operasi lintas modul memiliki kontrak input/output yang
    divalidasi dengan Zod.

## 6. Rancangan modul

### 6.1 Autentikasi dan pengguna

Tanggung jawab: - Setup awal sekali untuk membuat administrator
pertama. - Login/logout, sesi, reset password administrator, dan
pemaksaan perubahan password sementara. - Aktivasi/nonaktivasi anggota
dan pengaturan password awal. - Pendaftaran publik nonaktif secara
default. - Pengaturan API key pribadi dan izin penggunaan API key
bersama. - Pembatasan percobaan login dan invalidasi sesi saat reset
password atau penonaktifan akun.

Kebijakan: - Kata sandi di-hash menggunakan `crypto.scrypt` bawaan
Node.js dengan salt acak unik dan parameter yang terdokumentasi; jangan
simpan kata sandi plaintext. - Session ID harus acak, cookie `HttpOnly`,
`SameSite` yang sesuai, `Secure` pada HTTPS, dan sesi disimpan di
SQLite, bukan MemoryStore pada server produksi. - Mode lokal tetap
memakai autentikasi yang sama kecuali keputusan produk terpisah secara
eksplisit menyatakan mode single-user tanpa login. - Admin tidak
mendapat akses otomatis ke isi proyek privat.

### 6.2 Proyek dan percakapan

Tanggung jawab: - Membuat proyek dari chat kosong; nama proyek dapat
ditentukan saat cukup informasi tersedia. - Mengelola status
aktif/selesai/arsip, rename, duplicate, restore, dan delete. - Sidebar,
pencarian metadata, riwayat chat, dan konteks proyek. - Duplicating
project menyalin informasi inti, dokumen konteks, plan, task,
attachment, dan memory; tidak menyalin riwayat chat. Salinan harus punya
ID baru dan relasi internalnya dibangun ulang secara konsisten. -
Restore dari arsip memakai menu arsip dan konfirmasi; sistem memeriksa
dependensi dan status sebelum memulihkan, tanpa mengubah isi proyek
diam-diam. - Impor proyek portabel tidak menjadi fitur standar. Backup
ditujukan untuk recovery, bukan transfer proyek antar-instance.

### 6.3 Memori dan keputusan

Data dipisahkan menjadi: - Riwayat percakapan biasa. - Memori
terstruktur: persyaratan, preferensi UI, keputusan, batasan, dan keadaan
proyek. - Keputusan terkunci dan sumber keputusan. - Relasi ke dokumen,
rencana, tugas, dan percobaan.

Memori boleh tersimpan otomatis, tetapi keputusan terkunci tidak boleh
tertimpa. Konflik informasi baru dengan keputusan lama harus memunculkan
pertanyaan eksplisit. Perbaikan memori dilakukan melalui chat; tidak
diperlukan halaman manajemen memori khusus. Pemilihan konteks dilakukan
dinamis berdasarkan tahap, artefak terkait, dan percakapan relevan,
kemudian ditampilkan kepada pengguna sebelum dikirim ke provider.

### 6.4 Provider dan model AI

Setiap provider memiliki konfigurasi: nama tampilan, jenis/protokol API,
base URL, autentikasi, model, parameter, header kustom yang diizinkan,
batas request, dan status validasi koneksi. API key boleh disimpan pada
file konfigurasi lokal sesuai keputusan produk, dengan mitigasi: - File
tidak berada dalam `public/`, tidak di-commit, tidak masuk export
dokumen, dan dibatasi izin OS. - Nilai key ditutupi di UI dan di-redact
dari log. - Provider shared dan personal memiliki scope yang jelas. - UI
menjelaskan provider yang menerima data, konteks/lampiran yang akan
dikirim, dan potensi penggunaan token/biaya. - Jangan menyatakan harga
aktual jika tidak diketahui; pisahkan pemakaian token, estimasi biaya,
dan biaya yang dikembalikan provider. - Pengujian koneksi tidak mengirim
isi proyek kecuali pengguna secara eksplisit memulai permintaan AI. -
Daftar model dapat disinkronkan bila provider mendukung; model manual
tetap dimungkinkan. - Model default ditentukan per jenis tugas;
perubahan tahap memilih default tahap tersebut, namun pengguna boleh
mengganti model. - Model yang menjalankan Rencanaku.ai dipisahkan dari
model coding agent eksternal yang direkomendasikan.

### 6.5 AI jobs dan antrean

Job yang berpotensi lama disimpan sebagai record dengan: - `id`,
`owner_user_id`, `project_id`, `job_type`, `status`, `stage`,
`progress`, `provider_id`, `model_id`, `created_at`, `updated_at`,
`started_at`, `finished_at`, `cancel_requested_at`, `error_code`,
`safe_error_message`, `input_snapshot_id`, dan `result_reference`. -
Status: `queued`, `running`, `waiting_retry`, `cancel_requested`,
`cancelled`, `succeeded`, `failed`. - Tahapan pekerjaan dan hasil sukses
per tahap disimpan agar dapat dilanjutkan setelah gangguan. -
Concurrency dan prioritas konfigurabel. - Rate limit provider ditangani
dengan backoff yang dibatasi, antrean, dan pemberitahuan. - Pembatalan
lokal tidak menjamin request provider berhenti atau biaya tidak
dikenakan; UI harus menjelaskan keterbatasan tersebut. - Hasil parsial
tidak diterapkan ke dokumen resmi tanpa validasi dan persetujuan.

### 6.6 Dokumen

Dokumen memiliki versi, status draft/proposal/approved, jenis dokumen,
hash konten, hubungan dengan plan/task/prompt, dan catatan asal
perubahan. Alur edit: 1. Tentukan file dan versi yang dimaksud. 2. Baca
file atau rentang baris relevan saja. 3. Buat proposal. 4. Validasi
format dan konsistensi. 5. Hitung diff. 6. Tampilkan perubahan: merah
untuk baris dihapus, hijau untuk baris ditambahkan. 7. Pengguna menerima
atau menolak kelompok diff. 8. Sebelum penerapan, verifikasi hash/versi
file belum berubah. 9. Jika stale, hitung ulang diff; jangan menimpa
perubahan baru. 10. Simpan versi baru dan catat hubungan dengan
keputusan/plan/task terkait.

Markdown dipreview melalui parser dan sanitasi HTML. Konten mentah yang
berasal dari AI atau lampiran tidak boleh diperlakukan sebagai HTML
tepercaya.

### 6.7 Plan, task, prompt, dan trial

-   Plan dihasilkan setelah pemeriksaan kesiapan: persyaratan,
    dependensi, risiko, keputusan belum selesai, dan acceptance
    criteria.
-   Plan muncul dalam modal/ruang review, dapat direvisi, dan
    membutuhkan persetujuan.
-   Task mempunyai status `not_started`, `in_progress`, `done`,
    `blocked`; status `done` hanya diubah pengguna.
-   Task menyimpan dependensi, urutan, acceptance criteria, prompt
    utama, prompt revisi, hasil laporan, validasi, dan trial history.
-   Prompt format direkomendasikan berdasarkan coding agent target,
    dengan penjelasan dan override manual.
-   Setiap trial menghubungkan prompt, revisi, bukti, laporan,
    kesimpulan validasi, waktu, dan hasil.
-   Bukti yang tidak cukup menghasilkan status `unverified`, bukan klaim
    lulus.
-   Jika plan berubah, sistem menganalisis dampak terhadap dependensi,
    acceptance criteria, docs, prompt, dan urutan; pengguna menyetujui
    rekonsiliasi.
-   Penutupan proyek memerlukan pemeriksaan tugas, acceptance criteria,
    masalah belum terselesaikan, dokumen final, dan konfirmasi pengguna.

### 6.8 Penyimpanan dan lampiran

-   SQLite untuk metadata, relasi, status, versi, dan indeks pencarian
    metadata.
-   File system untuk dokumen besar, lampiran, backup, dan file
    sementara.
-   File diberi nama internal yang aman; nama asli disimpan sebagai
    metadata.
-   Jangan gunakan path dari input pengguna sebagai path filesystem.
-   Upload memvalidasi ukuran, jumlah, ekstensi, MIME, dan signature
    file bila relevan.
-   Tidak ada file yang diunggah yang dieksekusi.
-   Lampiran dapat dipakai kembali di percakapan, dokumen, plan, dan
    task dengan relasi yang jelas.
-   Pemilihan file yang dikirim ke AI selalu eksplisit dan dapat diedit.
-   Storage monitor menampilkan penggunaan total/per proyek, file besar,
    backup, peringatan ruang rendah, dan daftar cleanup aman. Jangan
    otomatis menghapus file aktif/terpakai.
-   Backup harus menjaga konsistensi SQLite dan file. Saat menggunakan
    SQLite WAL, gunakan backup API/snapshot yang aman, atau
    hentikan/koordinasikan penulisan selama snapshot; jangan sekadar
    menyalin file `.sqlite` saat transaksi aktif.

### 6.9 Backup, trash, dan restore

-   Backup manual dan terjadwal dengan retensi terkonfigurasi.
-   Backup mencakup database, dokumen, lampiran, metadata konfigurasi
    non-rahasia yang dipilih, dan manifest.
-   Rahasia provider tidak otomatis disertakan dalam backup standar;
    bila fitur backup konfigurasi rahasia disediakan, harus menjadi
    pilihan eksplisit yang terlindungi.
-   Setiap backup mempunyai manifest versi skema, waktu, checksum, versi
    aplikasi, dan daftar konten.
-   Restore diuji pada lokasi staging sebelum menggantikan data aktif.
-   Hapus proyek memindahkan ke trash terlebih dahulu; penghapusan
    permanen mengikuti aturan retensi yang terlihat dan konfirmasi
    eksplisit.
-   UI menjelaskan bahwa backup lama dapat masih menyimpan salinan data
    yang sudah dihapus.
-   Restore gagal tidak boleh meninggalkan database dan file pada
    keadaan campuran; gunakan staging, validasi, lalu swap atomik sebisa
    mungkin.
-   CLI menyediakan backup, restore, pemeriksaan integritas, dan status.

## 7. Rancangan data SQLite

Skema final dibuat melalui migrasi berurutan. Semua tabel memakai
primary key yang stabil (misalnya UUID), timestamp ISO-8601 UTC, foreign
key aktif, indeks yang sesuai, dan kolom ownership yang dapat diperiksa.
Nama berikut adalah model logis awal; migrasi dapat memecah/menyesuaikan
kolom selama invariannya terjaga.

### 7.1 Tabel inti

  -----------------------------------------------------------------------------------
  Tabel                   Tujuan                        Relasi penting
  ----------------------- ----------------------------- -----------------------------
  `users`                 Akun, role, status, status    Satu pengguna memiliki banyak
                          ganti password                proyek

  `sessions`              Sesi login                    Terhubung ke user

  `projects`              Identitas, status, owner,     Memiliki percakapan, dokumen,
                          waktu, arsip/trash            plan, tasks

  `project_members`       Disiapkan untuk izin          Tidak memberikan sharing
                          eksplisit jika sharing kelak  secara default
                          disetujui                     

  `conversations`         Sesi percakapan per proyek    Memiliki messages

  `messages`              Pesan pengguna/AI/tool,       Terhubung ke conversation dan
                          status dan metadata           opsional job

  `attachments`           Metadata file, MIME, ukuran,  File bytes disimpan di
                          hash, path internal           filesystem

  `attachment_links`      Menghubungkan lampiran ke     Polimorfik terkontrol atau
                          message/document/task/trial   tabel relasi khusus

  `project_memories`      Memori terstruktur, tipe,     Terhubung ke project dan
                          nilai, sumber,                sumber
                          confidence/status             

  `decisions`             Keputusan, status locked,     Terhubung ke project dan
                          alasan, versi                 sumber

  `providers`             Konfigurasi provider          Shared/personal scope
                          non-secret atau referensi     
                          konfigurasi                   

  `provider_models`       Daftar model, capability,     Terhubung ke provider
                          parameter dan status          

  `ai_jobs`               Antrean dan status proses AI  Terhubung ke
                                                        user/project/provider/model

  `job_stage_results`     Output tiap tahap yang sukses Memungkinkan recovery/resume

  `documents`             Metadata dokumen dan current  Terhubung ke project
                          version                       

  `document_versions`     Konten/penunjuk file, hash,   Terhubung ke document
                          author, status, diff metadata 

  `plans`                 Versi plan dan status         Terhubung ke project
                          persetujuan                   

  `plan_versions`         Snapshot plan terstruktur     Memiliki tasks atau task
                                                        revisions

  `tasks`                 Task, status, urutan,         Terhubung ke plan version
                          acceptance criteria           

  `task_dependencies`     Relasi task                   Cegah self-dependency dan
                          prerequisite/dependent        siklus

  `prompts`               Prompt utama/revisi, target   Terhubung ke task
                          format, versi                 

  `trials`                Percobaan coding agent        Terhubung ke task dan prompt

  `trial_artifacts`       Laporan, bukti, file          Terhubung ke trial
                          pendukung                     

  `notifications`         Notifikasi aktivitas dan      Terhubung ke user
                          error                         

  `usage_events`          Token dan estimasi biaya bila Terhubung ke
                          tersedia                      job/provider/user

  `audit_events`          Perubahan sensitif dan        Metadata minimum, tanpa
                          operasi admin                 rahasia

  `backup_records`        Metadata backup dan checksum  Path backup di luar
                                                        database/manifest

  `trash_items`           Item yang menunggu            Owner, waktu hapus, waktu
                          penghapusan permanen          retensi

  `app_settings`          Preferensi dan pengaturan     Scope instance/user
                          non-rahasia                   
  -----------------------------------------------------------------------------------

### 7.2 Aturan integritas

-   Aktifkan `PRAGMA foreign_keys = ON` pada setiap koneksi.
-   Gunakan transaksi untuk operasi yang memperbarui beberapa tabel.
-   Tambahkan indeks pada `owner_user_id`, `project_id`, `status`,
    `created_at`, foreign keys, dan metadata pencarian yang sering
    dipakai.
-   Validasi bahwa project yang diminta memang milik user pada setiap
    use case, bukan hanya pada halaman dashboard.
-   Hapus/arsipkan relasi dengan aturan eksplisit; hindari cascade
    delete yang menghilangkan riwayat penting secara tak sengaja.
-   Gunakan tabel migration history dan migrasi immutable setelah rilis.
-   Simpan content hash untuk deteksi perubahan file.
-   Validasi DAG dependensi task sebelum menyimpan plan.
-   Gunakan optimistic concurrency (`version`, `updated_at`, atau hash)
    saat menerapkan diff.
-   Jalankan `PRAGMA integrity_check` saat diagnostic/restore
    validation.

### 7.3 Diagram relasi tingkat tinggi

``` mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ CONVERSATIONS : has
    CONVERSATIONS ||--o{ MESSAGES : contains
    PROJECTS ||--o{ PROJECT_MEMORIES : remembers
    PROJECTS ||--o{ DECISIONS : records
    PROJECTS ||--o{ DOCUMENTS : contains
    DOCUMENTS ||--o{ DOCUMENT_VERSIONS : versions
    PROJECTS ||--o{ PLANS : has
    PLANS ||--o{ TASKS : includes
    TASKS ||--o{ PROMPTS : generates
    TASKS ||--o{ TRIALS : tracks
    PROMPTS ||--o{ TRIALS : used_by
    TASKS ||--o{ TASK_DEPENDENCIES : depends_on
    USERS ||--o{ AI_JOBS : starts
    AI_JOBS ||--o{ JOB_STAGE_RESULTS : records
    PROJECTS ||--o{ ATTACHMENTS : references
    USERS ||--o{ NOTIFICATIONS : receives
```

## 8. Alur kerja utama

### 8.1 First-run setup

1.  CLI atau aplikasi mendeteksi bahwa setup belum selesai.
2.  Setup wizard meminta akun administrator pertama dan lokasi data.
3.  Pembuatan admin pertama dilindungi agar hanya dapat terjadi sekali;
    endpoint setup dinonaktifkan setelah sukses.
4.  Pengguna memilih provider AI atau melewatinya.
5.  Provider diuji tanpa mengirim konteks proyek.
6.  Wizard menjelaskan mode lokal/server dan privasi.
7.  Aplikasi membuat schema database, direktori privat, secret/session
    configuration, dan backup baseline.
8.  Aplikasi menampilkan dashboard; tindakan berbahaya belum tersedia
    jika konfigurasi dasar tidak valid.

### 8.2 Diskusi ke dokumen konteks

1.  Pengguna membuka chat proyek.
2.  Pemilihan konteks mengambil riwayat relevan, memori, keputusan, dan
    artefak terhubung.
3.  UI memperlihatkan konteks dan lampiran yang akan dikirim.
4.  AI memberi saran, mendeteksi konflik, dan meminta keputusan penting.
5.  Pengguna memilih jenis dokumen dari katalog dokumen yang memiliki
    nama, deskripsi, tujuan, kapan diperlukan, dan dependensi.
6.  Job menghasilkan draft dokumen.
7.  Validator memeriksa struktur, kelengkapan, konsistensi, dan
    referensi.
8.  UI menampilkan dokumen dan revisi yang dapat diminta.
9.  Dokumen disetujui, diberi versi, dan ditautkan ke keputusan yang
    relevan.

### 8.3 Dokumen ke plan dan prompt

1.  Sistem memeriksa readiness: persyaratan, dependensi, risiko,
    unresolved decisions, acceptance criteria.
2.  UI menjelaskan gap dan menawarkan perbaikan.
3.  Setelah pengguna melanjutkan, modal konfigurasi singkat meminta
    arahan dan pilihan model per tahap.
4.  Job menyusun plan terperinci.
5.  Plan ditampilkan untuk review, revisi, unduh, dan persetujuan.
6.  Setelah persetujuan, sistem menghasilkan task, dependensi,
    acceptance criteria, dan prompt per task.
7.  Setiap prompt diberi versi, konteks sumber, format target coding
    agent, dan rekomendasi model eksternal.
8.  Perubahan plan berikutnya memicu analisis dampak dan penandaan
    prompt stale.

### 8.4 Percobaan eksternal dan perbaikan

1.  Pengguna menjalankan prompt pada coding agent eksternal di luar
    Rencanaku.ai.
2.  Pengguna melaporkan hasil lewat chat atau formulir task dan
    menambahkan screenshot/file jika relevan.
3.  Sistem menyimpan trial terhubung ke task dan prompt versi yang
    digunakan.
4.  AI membandingkan bukti dengan acceptance criteria, memisahkan
    `satisfied`, `failed`, dan `unverified`.
5.  AI menyusun prompt tindak lanjut yang mempertahankan tujuan task dan
    riwayat sebelumnya.
6.  Pengguna meneruskan prompt revisi ke coding agent.
7.  Siklus berulang sampai pengguna sendiri menandai task selesai.
8.  Task berikutnya hanya dimulai bila dependensi terpenuhi.

### 8.5 Perubahan dokumen dan plan

1.  Perubahan AI disimpan sebagai proposal.
2.  Validator melakukan pemeriksaan khusus tipe artefak.
3.  Sistem menghitung diff dan menampilkan perubahan.
4.  Pengguna menerima/menolak diff group.
5.  Sistem memverifikasi hash versi sumber; bila berubah sejak proposal
    dibuat, diff harus dihitung ulang.
6.  Setelah penerapan, analisis dampak menandai plan, task, dan prompt
    yang perlu ditinjau.
7.  Perubahan resmi memerlukan persetujuan sesuai alur plan/keputusan.

## 9. Kontrak internal provider AI

### 9.1 Adapter interface

Semua adapter harus mengimplementasikan kontrak internal yang setara
dengan:

``` js
export class AIProviderAdapter {
  async listModels() {
    throw new Error("Not implemented");
  }

  async validateConnection() {
    throw new Error("Not implemented");
  }

  async generate(request, options = {}) {
    throw new Error("Not implemented");
  }

  async cancel(requestId) {
    return { supported: false, requestId };
  }

  normalizeError(error) {
    return {
      code: "PROVIDER_ERROR",
      retryable: false,
      message: "Permintaan ke provider gagal."
    };
  }
}
```

Contoh ini hanya kontrak konseptual; implementasi final boleh
menggunakan interface/validator yang sesuai. Pesan error yang
dikembalikan ke pengguna harus aman, sedangkan detail teknis yang sudah
di-redact dapat disimpan dalam log diagnostik.

### 9.2 Bentuk permintaan internal

Setiap request berisi: - `jobId`, `projectId`, `userId`. -
`taskType`/`stage`. - `providerId`, `modelId`. - Instruksi sistem dan
pesan terstruktur. - Dokumen/memori/keputusan relevan. - Referensi
lampiran yang telah disetujui untuk dikirim. - Batas token,
temperature/parameter yang didukung, timeout, dan kebijakan retry. -
Skema output yang diharapkan. - Snapshot konteks dan versi artefak yang
menjadi dasar request.

### 9.3 Validasi hasil

1.  Parse respons provider.
2.  Normalisasi finish reason, usage, request ID, dan error.
3.  Validasi JSON/struktur dengan Zod bila output terstruktur.
4.  Validasi jenis artefak.
5.  Pemeriksaan konsistensi dengan keputusan locked dan acceptance
    criteria.
6.  Simpan hasil tahap ke job stage.
7.  Hasil yang gagal validasi tidak diterapkan ke dokumen resmi.
8.  Catat token dan biaya hanya bila data tersedia; tandai estimasi
    sebagai estimasi.

## 10. Kontrak HTTP dan UX

### 10.1 Prinsip routing

-   Web routes mengembalikan halaman EJS.
-   Endpoint Fetch dipakai untuk operasi dinamis seperti kirim pesan,
    polling job, autosave, upload, persetujuan diff, dan update status.
-   Semua mutasi harus memerlukan autentikasi, otorisasi object-level,
    validasi input, dan CSRF token.
-   API internal menggunakan JSON dengan struktur error konsisten.
-   Endpoint tidak boleh mengembalikan filesystem path atau rahasia
    provider.
-   Request ID disertakan di log dan error response untuk diagnosis.

### 10.2 Kelompok endpoint konseptual

  -----------------------------------------------------------------------------
  Area                                Operasi contoh
  ----------------------------------- -----------------------------------------
  Auth/setup                          `GET /setup`, `POST /setup`,
                                      `POST /login`, `POST /logout`

  Dashboard                           `GET /`, `GET /projects`

  Project                             `POST /api/projects`,
                                      `PATCH /api/projects/:id`,
                                      `POST /api/projects/:id/archive`,
                                      `POST /api/projects/:id/restore`,
                                      `POST /api/projects/:id/duplicate`

  Conversation                        `GET /projects/:id/chat`,
                                      `POST /api/projects/:id/messages`

  Jobs                                `GET /api/jobs/:id`,
                                      `POST /api/jobs/:id/cancel`,
                                      `POST /api/jobs/:id/retry`

  Providers                           `GET /settings/providers`,
                                      `POST /api/providers`,
                                      `POST /api/providers/:id/test`

  Documents                           `GET /projects/:id/documents/:docId`,
                                      `POST /api/documents/:id/proposals`,
                                      `POST /api/documents/:id/apply-diff`

  Plans/tasks                         `POST /api/projects/:id/plan`,
                                      `POST /api/plans/:id/approve`,
                                      `PATCH /api/tasks/:id/status`

  Trials                              `POST /api/tasks/:id/trials`,
                                      `POST /api/trials/:id/follow-up-prompt`

  Attachments                         `POST /api/uploads`,
                                      `GET /api/attachments/:id/download`

  Backup                              `POST /api/backups`, `GET /api/backups`,
                                      `POST /api/backups/:id/restore`

  Health                              `GET /health/live`, `GET /health/ready`
  -----------------------------------------------------------------------------

Rute di atas adalah nama konseptual. Saat implementasi, semua endpoint
harus memiliki schema request/response, permission, error codes, serta
test. Jangan mengimplementasikan endpoint yang melewati use case/domain
service.

### 10.3 Struktur error

``` json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Periksa kembali data yang dimasukkan.",
    "requestId": "generated-request-id",
    "details": []
  }
}
```

`details` tidak boleh memuat API key, token sesi, path rahasia, isi
lampiran privat yang tidak perlu, atau stack trace mentah.

## 11. Keamanan dan privasi

### 11.1 Autentikasi dan sesi

-   Hash password dengan algoritme yang dirancang untuk password, salt
    acak, dan parameter terdokumentasi.
-   Cookie sesi `HttpOnly`; `Secure` saat HTTPS; `SameSite` disesuaikan
    dengan alur aplikasi.
-   Rotasi session ID setelah login dan perubahan hak akses.
-   Invalidasi sesi saat reset password, deaktivasi akun, dan perubahan
    kredensial sensitif.
-   Batasi percobaan login dan berikan respons yang tidak membocorkan
    apakah akun tertentu ada.
-   Setup admin pertama hanya dapat dipakai satu kali dan harus aman
    saat dua request terjadi bersamaan.

### 11.2 Otorisasi

-   Semua query proyek dibatasi dengan owner ID yang berasal dari sesi
    server.
-   Admin tidak otomatis dapat membaca proyek privat.
-   Shared API key dan personal API key memiliki izin, kuota, dan
    pencatatan penggunaan yang berbeda.
-   Audit log mencatat tindakan sensitif tanpa isi percakapan atau
    rahasia yang tidak diperlukan.

### 11.3 Proteksi web

-   Helmet dan Content Security Policy yang sesuai.
-   CSRF protection untuk semua mutasi yang memakai cookie sesi.
-   Validasi input server-side menggunakan Zod.
-   Output escaping pada EJS; sanitasi Markdown HTML menggunakan
    DOMPurify di browser dan sanitasi server bila HTML dihasilkan di
    server.
-   Rate limiting untuk login, upload, request AI, backup/restore, dan
    endpoint berbiaya tinggi.
-   Batas body request, timeout, dan batas ukuran file.
-   Validasi MIME, ekstensi, signature, nama file, dan lokasi
    penyimpanan.
-   Jangan mengizinkan traversal path, SSRF melalui base URL provider
    tanpa validasi, atau akses ke alamat metadata internal dari
    konfigurasi provider.
-   Header custom provider dibatasi dan tidak boleh menimpa header
    keamanan internal secara arbitrer.
-   File upload tidak dieksekusi dan tidak disajikan inline tanpa
    kontrol.
-   Log menghapus API key, authorization header, cookie, password,
    prompt rahasia yang tidak perlu, dan isi attachment.
-   Jangan menyimpan rahasia di git, contoh konfigurasi, test fixture,
    atau log.

### 11.4 Data provider dan AI

Sebelum request AI, pengguna harus dapat melihat: - Provider dan model
yang digunakan. - Jenis data/konteks/lampiran yang akan dikirim. -
Apakah data akan keluar dari perangkat/server lokal menuju provider. -
Estimasi token/biaya jika dapat dihitung, dengan penanda jelas untuk
estimasi. - Opsi mengedit konteks atau membatalkan pengiriman.

API key disimpan dalam konfigurasi lokal plaintext sesuai keputusan
produk, sehingga mitigasi file permission, scope akses, masking,
redaction, backup policy, dan peringatan server multi-user adalah wajib.
Untuk deployment server, operator harus diberi peringatan bahwa akses
filesystem/server memiliki risiko terhadap file konfigurasi tersebut.

### 11.5 Threat model awal

  -----------------------------------------------------------------------
  Ancaman                             Mitigasi minimum
  ----------------------------------- -----------------------------------
  Anggota membaca proyek anggota lain Ownership checks di semua use
                                      case/repository query; integration
                                      test lintas akun

  CSRF                                Token CSRF pada mutasi berbasis
                                      sesi

  XSS melalui Markdown/AI             Escape output dan sanitasi HTML

  Path traversal saat upload/download ID internal dan path resolver yang
                                      dibatasi root

  File berbahaya diunggah             Validasi tipe/ukuran, tidak
                                      dieksekusi, penyimpanan privat

  API key bocor                       File privat, permission, masking,
                                      log redaction, tidak masuk git

  Request AI ganda/mahal              Idempotency, job status,
                                      concurrency limit, rate limit

  Restore merusak data                Staging, manifest, checksum, backup
                                      sebelum restore, validasi

  Admin mengakses konten privat       Pisahkan izin administrasi dari
                                      izin isi proyek

  Dependency supply-chain             Lockfile, audit, update terkontrol,
                                      CI dan provenance bila tersedia

  Provider URL disalahgunakan         Validasi skema/host, blokir alamat
                                      internal, kebijakan custom provider
                                      yang jelas

  Disk penuh                          Peringatan dini, cleanup terarah,
                                      tidak menghapus file aktif otomatis
  -----------------------------------------------------------------------

## 12. Job runner, retry, dan pemulihan

### 12.1 Model job

-   Job disimpan di SQLite sebelum mulai dijalankan.
-   Worker lokal mengambil job berdasarkan prioritas dan batas
    concurrency.
-   Job menyimpan checkpoint per tahap.
-   Status dapat dibaca dari UI melalui polling berkala; tidak wajib
    memakai WebSocket pada MVP.
-   Pembatalan menetapkan flag dan menghentikan proses lokal pada titik
    aman.
-   Retry mengikuti kategori error: jaringan sementara, rate limit,
    provider overload, invalid credentials, invalid output, context
    limit, atau konfigurasi salah.
-   Retry otomatis dibatasi; setelah batas tercapai, UI menawarkan retry
    manual, ganti model, edit konteks, atau perbaiki konfigurasi.
-   Jika input atau dokumen sumber berubah, hasil tahap lama hanya dapat
    dipakai kembali jika fingerprint input cocok.
-   Hasil yang telah berhasil tidak boleh hilang hanya karena tahap
    berikutnya gagal.

### 12.2 Kebijakan retry

-   Retry otomatis hanya untuk error sementara yang aman untuk diulang.
-   Gunakan exponential backoff dengan jitter dan batas maksimum.
-   Jangan mengulang otomatis kesalahan kredensial, request tidak valid,
    atau output invalid tanpa perubahan input/strategi.
-   Idempotency key dipakai pada operasi internal agar request duplikat
    tidak membuat job/prompt/dokumen ganda.
-   UI menjelaskan bahwa cancel di sisi Rencanaku.ai belum tentu
    membatalkan proses provider eksternal.

## 13. Operasi CLI

CLI menggunakan Commander dan memanggil layanan aplikasi yang sama.

Perintah target: - `rencanaku start` --- menjalankan server. -
`rencanaku stop` --- meminta server berhenti dengan aman bila proses
dikelola supervisor yang mendukung. - `rencanaku status` --- status
proses, versi aplikasi, DB, storage, dan konfigurasi penting yang tidak
sensitif. - `rencanaku logs` --- menampilkan log terpilih dengan rahasia
di-redact. - `rencanaku doctor` --- validasi konfigurasi, izin folder,
koneksi database, ruang disk, dan kesiapan provider opsional. -
`rencanaku backup` --- membuat backup yang konsisten. -
`rencanaku restore <backup-id>` --- memvalidasi dan memulihkan setelah
konfirmasi. - `rencanaku migrate` --- menjalankan migrasi secara
eksplisit atau sebagai bagian prosedur update. -
`rencanaku update-check` --- memeriksa versi dan menampilkan informasi
rilis. - `rencanaku update-prepare` --- memeriksa kompatibilitas,
membuat backup, dan memberi instruksi migrasi.

CLI **tidak mengunduh atau menginstal pembaruan otomatis**. Pengguna
mengunduh dan memasang pembaruan secara manual setelah menerima
informasi dan menjalankan backup/persiapan migrasi.

## 14. Deployment

### 14.1 Lokal

-   Satu proses Node.js.
-   Data di direktori yang dapat dikonfigurasi.
-   Bind ke `127.0.0.1` secara default untuk penggunaan lokal.
-   CLI untuk start/stop/status/logs/backup/restore.
-   Setup wizard untuk akun admin, lokasi data, dan konfigurasi provider
    opsional.

### 14.2 Server/LAN

-   Bind ke interface yang dipilih operator; jangan membuka port ke
    jaringan tanpa peringatan.
-   Wajib autentikasi, HTTPS melalui reverse proxy atau terminasi TLS
    yang dirancang dengan benar, cookie secure, rate limit, backup,
    serta konfigurasi secret yang terlindungi.
-   Cegah akses publik tak sengaja melalui firewall dan bind address.
-   Tampilkan peringatan jika aplikasi berjalan tanpa HTTPS pada
    jaringan yang tidak tepercaya.
-   Data proyek anggota tetap privat.
-   Shared key perlu kuota, log penggunaan, dan kontrol admin.

### 14.3 Docker

-   Satu image aplikasi; tidak memecah domain menjadi layanan.
-   Volume persisten untuk `data/`.
-   Jangan menyimpan database dalam layer image atau filesystem
    container yang ephemeral.
-   Jalankan sebagai user non-root.
-   Gunakan healthcheck dan graceful shutdown.
-   Versi image Node dikunci; dependency install menggunakan `npm ci`.
-   Backup tetap dibutuhkan di luar volume utama; volume bukan pengganti
    backup.
-   Restore dan migrasi harus diuji pada salinan volume sebelum rilis.

## 15. Observabilitas dan diagnostik

-   Log terstruktur dengan timestamp UTC, level, request ID, user ID
    internal (bukan rahasia), job ID, module, error code, dan duration.
-   Default logging hanya metadata. Detail tambahan dapat diaktifkan
    secara eksplisit dan harus tetap meredaksi rahasia.
-   Health endpoint `live` menunjukkan proses hidup; `ready` menunjukkan
    konfigurasi/data store siap.
-   Health monitor memeriksa DB, akses storage, ruang disk, job queue,
    versi/migrasi, backup terakhir, dan provider bila pemeriksaan
    provider diaktifkan.
-   Diagnostics menampilkan status, kode error, dampak, rekomendasi
    perbaikan, dan log teknis yang dapat diekspor setelah redaction.
-   Tidak ada klaim bahwa provider tersedia hanya berdasarkan
    keberhasilan konfigurasi; uji koneksi harus benar-benar dijalankan.
-   Bug report dilakukan manual melalui chat pada baseline awal; belum
    ada sistem tiket internal khusus.

## 16. Pengujian dan quality gates

### 16.1 Piramida tes

1.  **Unit:** domain rules, readiness checks, memory conflict detection,
    diff logic, retry classification, dependency graph, validators.
2.  **Integration:** repository SQLite, migrations, transaction
    rollback, ownership checks, sessions, file storage, provider
    adapters dengan mock.
3.  **HTTP/API:** route authorization, CSRF, validation, rate limiting,
    error mapping, upload/download.
4.  **Security:** IDOR, CSRF, XSS, path traversal, secret redaction,
    setup admin sekali, brute-force protection, SSRF guard custom
    provider.
5.  **Recovery:** backup/restore, interrupted jobs, corrupt manifest,
    checksum mismatch, disk full, failed migration.
6.  **Regression:** setiap bug yang ditemukan menghasilkan test yang
    mencegah pengulangan.
7.  **Manual acceptance:** desktop/tablet/mobile, keyboard-only, screen
    reader smoke checks, reduced motion, light/dark mode,
    Indonesian/English UI.
8.  **Deployment:** clean install, Docker volume persistence, restart,
    upgrade preparation, restore to staging, server multi-user privacy.

### 16.2 Gate sebelum merge

-   `npm ci` berhasil pada runtime yang dikunci.
-   Lint tidak memiliki error baru.
-   Unit dan integration tests lulus.
-   Migration tests lulus.
-   CSS build berhasil.
-   `npm audit` ditinjau; temuan tidak diabaikan tanpa alasan
    terdokumentasi.
-   Tidak ada rahasia di diff/log/test fixture.
-   Dokumentasi diperbarui.
-   File yang berubah dan dampaknya dijelaskan.
-   Tidak ada fitur yang dinyatakan selesai tanpa bukti tes.

## 17. Kinerja, aksesibilitas, dan UI

-   Desktop adalah target utama, tetapi layout harus responsif pada
    tablet dan mobile.
-   Sidebar kiri dapat diciutkan; navbar atas; konten terpusat.
-   Workspace dapat memprioritaskan chat atau panel dokumen/tugas yang
    dapat dibuka dan diubah ukurannya.
-   Tema terang/gelap dipilih manual.
-   Bahasa UI default Indonesia dengan pilihan Inggris; bahasa UI
    terpisah dari bahasa respons AI.
-   Status AI, provider/model, durasi, error, antrean, dan progres harus
    jelas.
-   Aksesibilitas: navigasi keyboard, fokus terlihat, kontras memadai,
    semantik HTML, label input, pesan error yang dapat dibaca screen
    reader, dan menghormati `prefers-reduced-motion`.
-   Jangan membuat interaksi penting hanya dapat dilakukan melalui
    drag-and-drop.
-   Gunakan pagination atau pemuatan bertahap untuk daftar besar;
    pencarian baseline menggunakan metadata, bukan full-text search.

## 18. Keputusan yang harus dikunci sebelum modul terkait

Hal berikut bukan alasan menunda seluruh fondasi, tetapi wajib
diputuskan sebelum implementasi terkait mencapai rilis: 1. Patch Node
dan versi paket final melalui instalasi/lockfile. 2. Strategi session
store final dan parameter hashing password. 3. Batas upload per tipe,
jumlah file, dan total storage. 4. Nilai default retensi backup/trash.
5. Kontrak status/kemajuan job dan batas retry. 6. Kebijakan timeout per
provider dan parameter model. 7. Daftar format lampiran yang dapat
diekstrak versus hanya disimpan/diteruskan. 8. Pilihan format backup
internal dan kebijakan secret di backup. 9. Port default, bind address,
dan instruksi reverse proxy. 10. Kebijakan backup saat disk rendah. 11.
Aturan final perbedaan mode lokal dan server pada first-run. 12. Retensi
log, notifikasi, audit event, dan data trial.

Setiap keputusan dicatat dalam `docs/decisions/` dengan konteks, opsi,
konsekuensi, tanggal, dan status.

## 19. Sumber kompatibilitas yang diperiksa

-   Node.js Release Schedule ---
    https://github.com/nodejs/Release/blob/main/README.md
-   Express 5 migration guide ---
    https://expressjs.com/en/guide/migrating-5/
-   Tailwind CSS CLI ---
    https://tailwindcss.com/docs/installation/tailwind-cli
-   Vitest guide --- https://vitest.dev/guide/
-   Vitest migration guide --- https://vitest.dev/guide/migration/
-   better-sqlite3 package ---
    https://www.npmjs.com/package/better-sqlite3
-   CodeMirror View package ---
    https://www.npmjs.com/package/%40codemirror/view
-   Marked package --- https://www.npmjs.com/package/marked

**Peringatan versi:** Dokumentasi registry dan framework dapat berubah.
Tabel di atas menetapkan baseline kompatibilitas, tetapi hanya
`package-lock.json` yang dihasilkan dan diverifikasi melalui `npm ci`,
tes, serta build pada runtime yang ditentukan dapat dianggap sebagai
daftar dependensi final untuk rilis.
