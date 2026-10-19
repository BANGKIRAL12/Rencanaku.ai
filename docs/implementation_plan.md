# implementation_plan.md --- Rencanaku.ai

**Versi dokumen:** 1.0\
**Status:** Rencana implementasi baseline\
**Dokumen acuan:** `PRD.md` dan `ARCHITECTURE.md`\
**Strategi:** implementasi bertahap, checkpoint eksplisit, modular
monolith, dan tidak melanjutkan tahap yang bergantung pada fondasi yang
gagal.

## 1. Tujuan rencana

Dokumen ini memandu pembangunan Rencanaku.ai dari repositori kosong
hingga aplikasi siap digunakan pada mode lokal, kemudian server
multi-pengguna dan Docker. Setiap fase menghasilkan artefak yang dapat
diperiksa dan diuji. Fase tidak dianggap selesai hanya karena kode telah
ditulis.

Rencanaku.ai adalah perencana proyek AI dan generator prompt untuk
coding agent eksternal. Aplikasi tidak mengubah source code proyek
target secara langsung. Pengguna menyetujui dokumen, plan, diff,
keputusan penting, status task, dan penutupan proyek.

## 2. Aturan pelaksanaan

1.  Baca `PRD.md`, `ARCHITECTURE.md`, dan rencana ini sebelum mengubah
    kode.
2.  Periksa repositori dan file yang sudah ada sebelum membuat file
    baru.
3.  Perbarui file yang sudah ada jika tugas meminta revisi; jangan
    membuat duplikat tanpa alasan.
4.  Satu task implementasi harus memiliki tujuan, input, file/area
    terdampak, dependensi, tes, dan acceptance criteria.
5.  Jangan lanjut ke fase berikutnya bila acceptance criteria fase saat
    ini gagal.
6.  Jangan mengubah keputusan produk terkunci tanpa persetujuan
    pengguna.
7.  Setiap perubahan skema database harus melalui migration yang dapat
    diuji.
8.  Jangan menyimpan API key atau rahasia di source, test fixture,
    contoh konfigurasi, log, atau repositori.
9.  Jangan menyatakan tes berhasil sebelum tes benar-benar dijalankan;
    catat perintah dan hasilnya.
10. Setiap perubahan harus menyertakan ringkasan file berubah, alasan,
    hasil tes, risiko, dan pekerjaan tersisa.
11. Gunakan `npm ci` pada CI dan verifikasi instalasi bersih.
12. Buat commit/checkpoint setelah setiap fase yang disetujui.
13. Jika dependency atau environment gagal, perbaiki fondasinya sebelum
    mengerjakan fitur di atasnya.
14. Semua hasil AI yang akan mengubah artefak resmi harus divalidasi dan
    melewati alur review/approval.
15. Tugas tidak dinyatakan `done` oleh AI; pengguna menentukan status
    selesai.

## 3. Urutan prioritas produk

### P0 --- fondasi wajib

-   Runtime/dependency baseline dan lockfile.
-   Struktur modular monolith.
-   Config validation, database, migrations, file storage.
-   First-run admin, login/session, authorization dan CSRF.
-   Dashboard dan proyek dasar.
-   Provider adapter dasar dan konfigurasi AI.
-   Chat, job persistence, retry/cancel dasar.
-   Autosave, logging, backup/restore dasar.

### P1 --- nilai inti produk

-   Memori terstruktur dan keputusan terkunci.
-   Attachment dan pemilihan konteks yang dapat diedit.
-   Dokumen konteks, editor/preview, proposal/diff, version history.
-   Readiness check, plan, persetujuan, task, dependency graph.
-   Prompt per task dan rekomendasi coding-agent target.
-   Trial history, laporan eksternal, prompt revisi, validation status.

### P2 --- kesiapan operasional

-   Multi-provider yang lebih luas, model sync, usage/cost display.
-   Notification center, advanced settings, storage monitor.
-   Backup terjadwal/retensi/trash, diagnostic/health monitor.
-   Docker, deployment server, security regression, aksesibilitas dan
    dokumentasi rilis.

## 4. Ringkasan fase dan gerbang

  -----------------------------------------------------------------------
  Fase                    Fokus                   Gerbang keluar
  ----------------------- ----------------------- -----------------------
  0                       Persiapan, keputusan    Runtime, package
                          teknis, baseline        manager, baseline
                          dependency              versi, dan aturan repo
                                                  disepakati

  1                       Inisialisasi proyek dan Clean install, app
                          build frontend          boot, CSS build, health
                                                  check lulus

  2                       Database, migrasi,      Migration/rollback,
                          storage, config,        integritas DB, file
                          logging                 isolation lulus

  3                       Auth, admin, role,      Test lintas akun
                          privacy boundary        membuktikan proyek
                                                  privat

  4                       Shell UI, dashboard,    Proyek dibuat dari chat
                          proyek, chat dasar      kosong; layout
                                                  responsif dasar

  5                       Provider/model          Provider mock dan
                          configuration dan AI    minimal satu provider
                          job engine              nyata lulus smoke test

  6                       Memori, keputusan,      Context preview akurat;
                          context selection,      locked decisions
                          attachments             terlindungi

  7                       Dokumen, editor, diff,  Proposal, validasi,
                          versioning, plan        approval, plan
                                                  readiness lulus

  8                       Task, prompt, trials,   Prompt/trial terhubung
                          repair loop             benar; task completion
                                                  tetap manual

  9                       Backup, restore, trash, Recovery dan storage
                          storage, notifications, safety tests lulus
                          diagnostics             

  10                      CLI, Docker, update     Clean deployment
                          preparation, security   lokal/server/Docker
                          hardening               lulus

  11                      Regression,             Acceptance test semua
                          accessibility, docs,    mode dan dokumentasi
                          release candidate       lengkap
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 5. Fase 0 --- Persiapan dan penguncian keputusan teknis

### Tujuan

Mencegah keputusan runtime dan library yang saling bertentangan sebelum
coding dimulai.

### Tugas

1.  Pastikan `PRD.md` dan `ARCHITECTURE.md` berada di root repositori.
2.  Buat `docs/decisions/` untuk Architecture Decision Records (ADR).
3.  Verifikasi status Node.js 24 LTS saat implementasi dimulai. Gunakan
    Node.js 24.x jika status Active LTS sudah berlaku dan dependensi
    native mendukungnya. Jika lingkungan belum siap, gunakan Node.js
    22.x yang masih didukung sebagai baseline sementara dan catat
    keputusan tersebut.
4.  Pastikan npm yang digunakan berasal dari instalasi runtime Node yang
    dipilih.
5.  Buat `.nvmrc` dan `.node-version` untuk mencatat versi Node yang
    dipilih; dokumentasikan cara memasangnya pada Windows, Linux, dan
    macOS.
6.  Tetapkan strategi ESM (`"type": "module"`).
7.  Susun `package.json` awal dengan script `start`, `dev`, `build:css`,
    `test`, `test:unit`, `test:integration`, `lint`, `check`, dan
    `doctor`.
8.  Tambahkan dependensi runtime dan development sesuai baseline pada
    `ARCHITECTURE.md`.
9.  Jalankan instalasi bersih dan catat hasil `npm ls --all`.
10. Pastikan `better-sqlite3` terpasang pada target OS/runtime yang
    didukung.
11. Commit `package.json` dan `package-lock.json`.
12. Buat matriks dukungan runtime/OS/arsitektur yang benar-benar diuji.

### Artefak

-   `package.json`, `package-lock.json`, `.nvmrc`, `.node-version`.
-   `docs/decisions/0001-runtime-and-dependencies.md`.
-   `docs/decisions/0002-module-system.md`.
-   Daftar platform yang masuk cakupan pengujian.

### Tes dan acceptance criteria

-   `node --version` cocok dengan versi yang dikunci.
-   `npm ci` selesai tanpa error.
-   Tidak ada peer dependency conflict yang belum dijelaskan.
-   `npm ls --all` tidak menampilkan dependency invalid yang belum
    ditangani.
-   Smoke test `better-sqlite3` membuka database sementara, menulis,
    membaca, dan menutup database.
-   Vitest berjalan pada runtime terpilih.
-   Versi patch yang ter-resolve dicatat, bukan hanya nomor major.

### Checkpoint 0

Minta persetujuan sebelum mengimplementasikan fitur aplikasi. Jika
dependency tree gagal, jangan lanjut.

------------------------------------------------------------------------

## 6. Fase 1 --- Fondasi repositori dan proses build

### Tujuan

Membuat aplikasi dapat dijalankan dengan struktur modular monolith dan
frontend server-rendered.

### Tugas

1.  Buat struktur direktori sesuai `ARCHITECTURE.md`.
2.  Implementasikan `src/config/schema.js` dan `src/config/env.js`
    menggunakan Zod.
3.  Validasi variabel konfigurasi ketika aplikasi mulai; tampilkan error
    yang aman dan instruksi perbaikan.
4.  Implementasikan `src/app.js` untuk membuat Express app tanpa
    langsung membuka port, agar mudah dites.
5.  Implementasikan `src/server.js` untuk memulai HTTP server dan
    graceful shutdown.
6.  Atur EJS view engine, layout, partial navbar, sidebar, content,
    flash/status messages, dan halaman error.
7.  Tambahkan Helmet, request ID, structured logger, body-size limits,
    error handler, dan route health.
8.  Tambahkan Tailwind CSS v4 melalui `tailwindcss` dan
    `@tailwindcss/cli` versi kompatibel yang dikunci.
9.  Buat `styles/input.css`; hasil build diletakkan ke
    `src/public/assets/css/` atau lokasi aset yang ditentukan, bukan di
    direktori data.
10. Pastikan build CSS memindai EJS views dan JavaScript lokal.
11. Tambahkan JavaScript vanilla untuk menu, dialog, status message, dan
    Fetch helper yang memiliki penanganan error konsisten.
12. Buat `GET /health/live` dan `GET /health/ready`.
13. Tambahkan halaman 404 dan 500 tanpa stack trace kepada pengguna.
14. Tambahkan tes untuk startup config valid/tidak valid, health
    endpoint, dan error handler.

### Artefak

-   App Express yang boot.
-   EJS layout dan halaman placeholder yang aman.
-   CSS build lokal.
-   Logger, middleware, health checks.
-   Tes startup dan HTTP dasar.

### Tes dan acceptance criteria

-   `npm run build:css` berhasil.
-   `npm test` menjalankan tes awal.
-   Aplikasi boot dengan config valid dan gagal cepat dengan pesan aman
    saat config wajib tidak valid.
-   CSS tidak bergantung pada CDN.
-   Tidak ada rahasia yang dicetak ke log.
-   Browser dapat membuka halaman health dan halaman awal.

### Checkpoint 1

Tinjau struktur direktori, script build, konfigurasi, dan pola error
sebelum database/domain ditambahkan.

------------------------------------------------------------------------

## 7. Fase 2 --- Database, migrasi, dan penyimpanan file

### Tujuan

Membangun fondasi persistensi yang aman sebelum membuat fitur bisnis.

### Tugas

1.  Implementasikan `src/db/connection.js` untuk membuka SQLite pada
    lokasi data terkonfigurasi.
2.  Aktifkan foreign keys, busy timeout, dan kebijakan jurnal yang
    dipilih.
3.  Evaluasi penggunaan WAL dengan backup strategy yang konsisten.
4.  Buat migration runner yang memiliki tabel `schema_migrations`.
5.  Buat migrasi awal untuk `users`, `sessions`, `projects`,
    `conversations`, `messages`, `app_settings`, dan `audit_events`.
6.  Implementasikan repository untuk setiap tabel awal.
7.  Semua query memakai prepared statements; jangan merangkai nilai
    input langsung ke SQL.
8.  Buat `FileStorageService` dengan root direktori yang terisolasi.
9.  Implementasikan safe path resolution yang menolak traversal dan path
    di luar root.
10. Implementasikan file ID internal, nama file tersimpan yang aman,
    metadata nama asli, hash, ukuran, MIME, dan waktu.
11. Buat direktori `files`, `projects`, `backups`, `logs`, `temp`, dan
    `config` dengan permission yang sesuai.
12. Pastikan direktori data tidak disajikan oleh Express static
    middleware.
13. Buat operasi temp-file lalu rename untuk penulisan file yang perlu
    atomicity.
14. Buat pemeriksaan integritas database dan penyimpanan.
15. Implementasikan repository transaction helper dan tes rollback.
16. Tambahkan migration test dari database kosong dan dari versi skema
    sebelumnya.

### Artefak

-   Database connection, migration runner, migrations, repositories.
-   File storage service.
-   `docs/database/schema.md`.
-   Tes integritas dan migrasi.

### Tes dan acceptance criteria

-   Migrasi database kosong sukses.
-   Foreign key violations terdeteksi.
-   Rollback transaksi bekerja.
-   Path traversal ditolak.
-   File tersimpan di luar public root.
-   Checksum file cocok dengan konten.
-   Kegagalan menulis file tidak menghasilkan record aktif yang menunjuk
    file tidak ada.
-   `PRAGMA integrity_check` berhasil pada database tes.

### Checkpoint 2

Review skema awal, pola migrasi, permission, dan konsistensi file/DB.
Jangan lanjut jika recovery dari kegagalan tulis belum aman.

------------------------------------------------------------------------

## 8. Fase 3 --- Autentikasi, admin awal, dan privasi

### Tujuan

Mengamankan seluruh fitur sebelum data proyek privat dibuat.

### Tugas

1.  Implementasikan `users`, `sessions`, role `admin`/`member`, status
    akun, dan `must_change_password`.
2.  Implementasikan hashing password dengan `crypto.scrypt`, salt acak,
    dan parameter terdokumentasi.
3.  Buat first-run setup wizard untuk admin pertama dan lokasi data.
4.  Pastikan setup hanya dapat diselesaikan satu kali, termasuk saat
    request bersamaan.
5.  Implementasikan login/logout, rotasi sesi setelah login, dan session
    invalidation.
6.  Implementasikan session store berbasis SQLite atau adapter yang
    telah dipilih; jangan memakai MemoryStore pada server.
7.  Konfigurasikan cookie HttpOnly, SameSite, Secure saat HTTPS, expiry,
    dan session secret.
8.  Implementasikan CSRF token pada semua operasi mutasi berbasis sesi.
9.  Terapkan rate limit login dan respons generik terhadap kredensial
    salah.
10. Implementasikan middleware `requireAuth`, `requireRole`, dan
    object-level ownership check.
11. Implementasikan admin membuat akun anggota, menetapkan password
    awal, mengaktifkan/menonaktifkan akun, dan reset password.
12. Password sementara harus diganti pada login berikutnya.
13. Reset password dan deaktivasi akun harus menginvalidasi sesi yang
    relevan.
14. Pendaftaran publik tetap nonaktif secara default.
15. Admin tidak diberi akses otomatis ke isi proyek privat.
16. Buat audit events untuk login, reset password, perubahan status
    akun, dan operasi admin sensitif.
17. Tambahkan tes keamanan lintas akun.

### Artefak

-   Login, logout, first-run wizard, account management.
-   Middleware auth, CSRF, rate limit, ownership.
-   Tes security dasar.

### Tes dan acceptance criteria

-   Admin pertama dapat dibuat sekali.
-   Setup tidak bisa dipakai ulang setelah selesai.
-   Password tidak disimpan plaintext.
-   CSRF request mutasi tanpa token ditolak.
-   Anggota A tidak dapat membaca/mengubah resource anggota B dengan
    mengganti ID.
-   Admin tidak otomatis dapat membaca isi proyek anggota.
-   Sesi invalid setelah reset password atau deaktivasi.
-   Pendaftaran publik tidak tersedia.
-   Login memiliki pembatasan percobaan dan log tidak membocorkan
    password.

### Checkpoint 3

Lakukan review keamanan sebelum membangun chat, provider, atau
attachment.

------------------------------------------------------------------------

## 9. Fase 4 --- Shell UI, dashboard, proyek, dan percakapan dasar

### Tujuan

Membangun pengalaman aplikasi yang dapat dinavigasi sebelum integrasi AI
lengkap.

### Tugas

1.  Implementasikan sidebar kiri yang dapat diciutkan, navbar atas, area
    konten, dan panel workspace.
2.  Buat tema light/dark dengan pilihan manual.
3.  Buat struktur bahasa UI Indonesia default dan Inggris sebagai opsi;
    jangan mengikat bahasa UI dengan bahasa jawaban AI.
4.  Implementasikan dashboard: proyek, pencarian metadata, status,
    aktivitas, progres plan, task yang memerlukan tindakan, dokumen
    terbaru, dan quick access.
5.  Implementasikan proyek dengan status aktif/selesai/arsip.
6.  Implementasikan rename, archive, restore, duplicate, dan
    delete-to-trash dengan konfirmasi yang sesuai.
7.  Buat alur first project yang membuka chat kosong; tidak wajib ada
    form pembuatan proyek panjang.
8.  Simpan percakapan dan pesan terpisah.
9.  Buat message composer, history, status request, error state,
    lampiran placeholder, dan model picker placeholder.
10. Buat layout workspace adaptif: fokus chat atau panel artefak yang
    dapat dibuka/diubah ukuran.
11. Implementasikan pencarian metadata proyek, percakapan, dokumen,
    prompt, dan attachment.
12. Implementasikan notification center dasar dan mark-read.
13. Tambahkan keyboard navigation, visible focus, semantic HTML, label,
    kontras, dan reduced-motion behavior.
14. Buat shortcut reference page; pengaturan shortcut lanjutan dapat
    ditambahkan di settings.

### Artefak

-   Dashboard dan workspace EJS.
-   CRUD proyek dasar dan chat yang tersimpan.
-   Preferensi UI.
-   Komponen navigasi, status, modal, tab, dan notifikasi.

### Tes dan acceptance criteria

-   Proyek baru dapat dimulai dari chat kosong.
-   Proyek dan percakapan bertahan setelah restart.
-   Pengguna hanya melihat proyek sendiri.
-   Archive/restore/duplicate/delete mempunyai alur konfirmasi yang
    tepat.
-   Layout bekerja pada desktop, tablet, dan mobile.
-   Navigasi keyboard tidak terjebak.
-   Status/error terlihat dan tidak hanya dibedakan dengan warna.

### Checkpoint 4

Minta review UI dan alur proyek sebelum integrasi AI nyata.

------------------------------------------------------------------------

## 10. Fase 5 --- Provider, model, dan job engine

### Tujuan

Menghubungkan AI secara modular dengan job yang dapat dipantau dan
dipulihkan.

### Tugas

1.  Definisikan kontrak `AIProviderAdapter`.
2.  Implementasikan adapter mock untuk pengujian tanpa biaya.
3.  Implementasikan satu adapter provider nyata sebagai vertical slice;
    pilih provider pertama sesuai konfigurasi yang tersedia.
4.  Implementasikan adapter lain secara bertahap hanya setelah kontrak
    adapter dan tes lolos.
5.  Buat konfigurasi provider dengan base URL, API format, model,
    parameter, header yang diizinkan, dan secret reference.
6.  Simpan API key di file konfigurasi privat sesuai keputusan produk;
    jangan taruh di database yang mudah diekspor atau di source.
7.  Buat UI tambah/edit/hapus provider, test connection, dan model list.
8.  Implementasikan sinkronisasi model jika provider mendukung; sediakan
    model manual.
9.  Buat model default per task type dan pilihan model pada composer.
10. Saat tahap kerja berubah, pilih default tahap; izinkan override
    manual.
11. Bedakan model yang menjalankan Rencanaku.ai dari model coding agent
    eksternal yang direkomendasikan.
12. Implementasikan `ai_jobs`, `job_stage_results`, job runner,
    concurrency limit, prioritas, polling, dan status.
13. Implementasikan timeout, retry classification, exponential backoff
    dengan jitter, dan batas retry.
14. Implementasikan cancellation flag; tampilkan bahwa proses provider
    mungkin tetap berjalan.
15. Validasi output provider dengan Zod dan validator per jenis artefak.
16. Simpan durasi, status, model/provider, error code, dan usage
    metadata jika tersedia.
17. Tambahkan masking key, log redaction, provider data notice,
    token/cost display dan estimasi yang diberi label.
18. Tambahkan queue/rate limit handling dan error recovery.
19. Uji bahwa hasil sukses per tahap tidak hilang saat tahap berikutnya
    gagal.

### Artefak

-   Adapter interface dan mock.
-   Satu provider nyata end-to-end.
-   Provider settings UI.
-   Job queue dan status UI.
-   `docs/providers/` berisi kontrak, setup, dan batasan provider.

### Tes dan acceptance criteria

-   Test adapter mock tidak memerlukan jaringan.
-   Provider test membuktikan koneksi benar-benar diuji.
-   Kegagalan auth tidak memicu retry tanpa akhir.
-   Rate limit mengantrekan atau memberi status menunggu.
-   Request duplikat tidak membuat job ganda bila idempotency
    diperlukan.
-   Output invalid tidak diterapkan ke dokumen.
-   API key tidak muncul pada UI, log, error, atau file export.
-   Job dapat dilanjutkan dari checkpoint yang berhasil jika input
    fingerprint tetap sama.

### Checkpoint 5

Demo vertical slice AI: input pengguna → job → provider → validasi →
hasil tersimpan → UI menampilkan status.

------------------------------------------------------------------------

## 11. Fase 6 --- Memori, keputusan, lampiran, dan pemilihan konteks

### Tujuan

Menjaga konteks proyek tetap konsisten, transparan, dan efisien.

### Tugas

1.  Buat migrasi `project_memories`, `decisions`, `attachments`, dan
    attachment links.
2.  Implementasikan penyimpanan memori terstruktur yang berbeda dari
    chat history.
3.  Catat sumber memori, waktu, tipe, confidence/status, dan relasi
    artefak.
4.  Implementasikan keputusan locked dengan history; AI tidak boleh
    menimpanya otomatis.
5.  Implementasikan conflict detection untuk informasi baru versus
    keputusan lama.
6.  Jika konflik signifikan, minta keputusan pengguna sebelum mengubah
    informasi resmi.
7.  Implementasikan koreksi memori melalui chat tanpa halaman manajemen
    memori khusus.
8.  Implementasikan layered summaries: conversation, decisions, project
    state, task details.
9.  Validasi ringkasan terhadap memory dan approved decisions.
10. Implementasikan context selector dinamis berdasarkan tahap, artefak
    terkait, dan relevansi.
11. Tampilkan tepatnya memori, dokumen, pesan, dan attachment yang akan
    dikirim; pengguna dapat mengedit pilihan.
12. Pertimbangkan batas context model; beri tahu bila materi diringkas
    atau dihilangkan.
13. Implementasikan upload untuk tipe yang dapat diproses, validasi
    file, size limits, metadata, dan storage quota.
14. Lampiran dapat ditautkan ke chat, docs, plan, task, dan trial.
15. Hanya lampiran yang disetujui yang dikirim ke provider.
16. Jelaskan pada UI bahwa file yang dikirim ke provider keluar dari
    perangkat/server lokal.
17. Jangan mengeksekusi file atau mempercayai instruksi yang ada di
    dalam file sebagai instruksi sistem.
18. Implementasikan label, filter, dan pencarian metadata attachment.

### Artefak

-   Memory and decisions services.
-   Context selection UI.
-   Upload and attachment library.
-   Data disclosure notice.
-   Tes conflict, permission, context preview, dan file validation.

### Tes dan acceptance criteria

-   Chat history dan memory tersimpan terpisah.
-   Locked decision tidak berubah tanpa approval.
-   Konflik signifikan meminta klarifikasi.
-   Context preview sama dengan data yang benar-benar dikirim.
-   File oversized/invalid ditolak.
-   Path file tidak bisa ditebak atau diakses pengguna lain.
-   Tidak ada file upload yang dieksekusi.
-   Batas context menghasilkan notifikasi tentang ringkasan/omisi.

### Checkpoint 6

Review akurasi context preview, privacy disclosure, dan keputusan
terkunci.

------------------------------------------------------------------------

## 12. Fase 7 --- Dokumen konteks, editor, diff, dan plan

### Tujuan

Membangun alur dokumen yang aman sebelum task prompts dibuat.

### Tugas dokumen

1.  Buat katalog tipe dokumen extensible dengan nama, deskripsi, tujuan,
    kondisi penggunaan, dan dependensi.
2.  Tampilkan daftar dokumen yang mungkin diperlukan; pengguna memilih
    lewat checkbox.
3.  AI dapat menyarankan dokumen tambahan saat dibutuhkan.
4.  Implementasikan dokumen dan versi dokumen dengan status
    draft/proposal/approved.
5.  Implementasikan Markdown preview dan editor.
6.  Gunakan CodeMirror 6 untuk file teks teknis yang memerlukan editing
    terstruktur; jangan memasang semua extension jika tidak diperlukan.
7.  Render Markdown menggunakan Marked dan sanitasi HTML sebelum
    memasukkan ke DOM.
8.  AI dapat merevisi bagian terpilih, bukan selalu membangun ulang
    seluruh dokumen.
9.  Implementasikan file/rentang baris yang dipilih untuk membatasi
    konteks.
10. Tampilkan diff merah/hijau dengan accept/reject per diff group dan
    accept/reject all.
11. Simpan hash/versi sumber proposal; jika stale, hitung ulang diff.
12. Validasi format dan konsistensi dokumen sebelum apply.
13. Hubungkan dokumen dengan keputusan, plan, task, dan prompt yang
    menggunakannya.
14. Jika dokumen berubah, analisis artefak yang terdampak dan tandai
    perlu ditinjau.

### Tugas plan

15. Implementasikan readiness check terhadap persyaratan, dependency,
    risiko, keputusan unresolved, dan acceptance criteria.
16. Berikan penjelasan gap sebelum plan dibuat.
17. Tampilkan modal instruksi singkat dan pemilihan model per tahap.
18. Hasilkan plan detail dengan struktur yang mengikuti kompleksitas
    proyek.
19. Tampilkan plan dalam modal/review view, sediakan revisi dan unduh.
20. Plan harus disetujui pengguna sebelum prompt resmi dibuat.
21. Simpan versi plan dan approval record.
22. Analisis dampak jika plan berubah; jangan mengubah task/prompt
    terkait diam-diam.

### Artefak

-   Document catalog, versioning, editor/preview, diff review.
-   Plan readiness, plan generator, approval flow.
-   Trace links dokumen ↔ plan ↔ task.

### Tes dan acceptance criteria

-   Dokumen dapat dipilih, dibuat, diedit, divalidasi, dan diberi versi.
-   Diff stale tidak diterapkan langsung.
-   Hanya perubahan yang disetujui yang masuk versi resmi.
-   HTML berbahaya dari Markdown tidak dieksekusi.
-   Readiness check menampilkan gap yang diketahui.
-   Plan tidak dapat disetujui jika struktur kritis tidak valid.
-   Prompt resmi tidak dibuat sebelum plan approved.
-   Perubahan dokumen/plan menandai dependensi yang terdampak.

### Checkpoint 7

Review beberapa skenario dokumen dan plan nyata. Pastikan approval dan
diff tidak dapat dilewati lewat request HTTP.

------------------------------------------------------------------------

## 13. Fase 8 --- Task, prompt, trial history, dan loop perbaikan

### Tujuan

Mengubah plan yang disetujui menjadi tugas yang dapat dijalankan oleh
coding agent eksternal.

### Tugas

1.  Implementasikan task berdasarkan plan version.
2.  Setiap task menyimpan urutan, tipe, status, dependency, acceptance
    criteria, konteks sumber, dan versi.
3.  Validasi DAG task dependencies dan menolak self-dependency/siklus.
4.  Izinkan pengguna mengubah urutan dan dependency dengan validasi
    ulang.
5.  Status task: `not_started`, `in_progress`, `done`, `blocked`.
6.  Hanya pengguna dapat menandai task `done`.
7.  Generate prompt terpisah per task, sesuai jenis pekerjaan dan target
    coding agent.
8.  Jelaskan rekomendasi format prompt dan izinkan override manual.
9.  Rekomendasikan model coding agent eksternal berdasarkan kemampuan
    dan efisiensi biaya; jangan mengarang harga.
10. Tampilkan konteks yang relevan dan sumbernya pada setiap prompt.
11. Simpan prompt utama, revisi, versi, hash, timestamp, dan hubungan ke
    task.
12. Buat input khusus instruksi perbaikan untuk setiap task.
13. Pengguna dapat melaporkan hasil sebagai chat bebas atau formulir
    task.
14. Lampiran bukti bisa berupa teks, file, dan screenshot.
15. Simpan setiap trial: prompt yang dipakai, hasil, bukti, validation
    conclusion, waktu, status, dan hubungan dengan trial sebelumnya.
16. Bandingkan versi prompt dan hasil.
17. Evaluasi bukti terhadap acceptance criteria; status harus membedakan
    `satisfied`, `failed`, dan `unverified`.
18. Buat follow-up prompt yang masih berada dalam task sama; jangan
    otomatis membuat task baru saat gagal.
19. Ulangi loop sampai pengguna menandai task done.
20. Saat plan berubah, tandai prompt/task stale dan tawarkan
    rekonsiliasi.
21. Sebelum penutupan proyek, periksa task, acceptance criteria,
    unresolved issues, dokumen final, lalu minta konfirmasi pengguna.

### Artefak

-   Task board/list, dependency editor.
-   Prompt generator dan prompt history.
-   Trial history, evidence attachment, validation summary.
-   Project closure review.

### Tes dan acceptance criteria

-   Task mengikuti plan yang approved.
-   Dependency siklik ditolak.
-   Prompt dan trial terhubung ke task yang benar.
-   Prompt revisi mempertahankan lineage.
-   Kegagalan trial tidak otomatis membuat task baru.
-   AI tidak menandai task done.
-   Bukti tidak lengkap menghasilkan unverified.
-   Plan update menghasilkan impact analysis.
-   Penutupan proyek memerlukan konfirmasi pengguna.

### Checkpoint 8

Demo satu task penuh: plan → prompt → laporan eksternal → evaluasi →
follow-up prompt → trial baru → user marks done.

------------------------------------------------------------------------

## 14. Fase 9 --- Operasi data, backup, restore, trash, dan notifikasi

### Tujuan

Memastikan data tidak mudah hilang dan operasi storage dapat diaudit.

### Tugas

1.  Implementasikan backup manual.
2.  Implementasikan backup terjadwal dan konfigurasi retensi.
3.  Buat manifest backup dengan versi aplikasi/schema, waktu, daftar
    file, dan checksum.
4.  Pastikan backup SQLite konsisten terhadap WAL/aktivitas transaksi.
5.  Sertakan database dan file terkait secara konsisten; definisikan
    secara eksplisit apakah konfigurasi provider rahasia dikecualikan.
6.  Buat restore ke staging, validasi manifest/checksum, pemeriksaan DB,
    lalu apply.
7.  Buat backup sebelum operasi restore yang berisiko.
8.  Uji restore pada lokasi terpisah; kegagalan tidak boleh mencampur
    data lama dan baru.
9.  Implementasikan trash dengan retensi dan penghapusan permanen yang
    dikonfirmasi.
10. Jelaskan bahwa backup lama mungkin masih berisi data yang dihapus.
11. Implementasikan duplicate project sesuai keputusan: salin data kerja
    utama dan attachment/memory, tanpa chat history.
12. Implementasikan archive restore dengan confirmation dan dependency
    checks.
13. Implementasikan storage monitor total/per project, file besar,
    backup, warning low disk, dan cleanup candidates.
14. Jangan menghapus file aktif/yang masih direferensikan secara
    otomatis.
15. Implementasikan notification center untuk status AI, error,
    dokumen/plan selesai, dan tindakan yang perlu pengguna.
16. Implementasikan mark read, filter, dan retention.
17. Implementasikan diagnostics, health monitor, error codes, repair
    suggestions, dan exportable redacted logs.
18. Tambahkan admin settings untuk shared providers, account status,
    backup, dan sistem tanpa akses otomatis ke project content.

### Artefak

-   Backup/restore service.
-   Trash/retention.
-   Storage dashboard.
-   Notifications and diagnostics.
-   Runbook recovery.

### Tes dan acceptance criteria

-   Backup dapat dipulihkan pada instance uji.
-   Checksum mismatch ditolak.
-   DB dan files konsisten setelah restore.
-   Retention mengikuti setting.
-   Delete tidak menghapus permanen sebelum kebijakan mengizinkan.
-   UI menjelaskan dampak backup terhadap penghapusan.
-   Storage warning muncul sebelum ruang habis sesuai threshold yang
    dikonfigurasi.
-   Cleanup tidak menghapus file aktif.
-   Diagnostic export tidak berisi API key/cookie/password.
-   Admin tidak dapat membaca isi proyek privat lewat backup/diagnostic
    UI tanpa izin yang secara eksplisit diberikan.

### Checkpoint 9

Wajib menjalankan simulasi database rusak, disk rendah, backup tidak
lengkap, dan restore gagal sebelum fitur dianggap siap.

------------------------------------------------------------------------

## 15. Fase 10 --- CLI, update preparation, Docker, dan deployment

### Tujuan

Membuat aplikasi dapat dipasang, dijalankan, diperiksa, dicadangkan, dan
dipulihkan.

### Tugas CLI

1.  Implementasikan CLI dengan Commander.
2.  Tambahkan `start`, `stop`, `status`, `logs`, `doctor`, `backup`,
    `restore`, `migrate`, `update-check`, dan `update-prepare`.
3.  Pastikan perintah CLI memakai service/repository yang sama dengan
    aplikasi web.
4.  Tambahkan graceful shutdown dan penanganan proses.
5.  Tampilkan error yang actionable dan tidak membocorkan rahasia.
6.  CLI memeriksa versi baru dan memberi informasi, tetapi tidak
    mengunduh/menginstal update secara otomatis.
7.  `update-prepare` menjalankan pemeriksaan konfigurasi, backup, dan
    pemeriksaan migrasi sebelum pengguna memasang update manual.

### Tugas deployment

8.  Buat Dockerfile multi-stage atau build yang sederhana dan
    reproducible.
9.  Gunakan user non-root.
10. Kunci Node image version dan gunakan `npm ci`.
11. Gunakan volume persisten untuk data.
12. Buat `compose.yaml` untuk deployment yang mudah diuji.
13. Tambahkan healthcheck, graceful shutdown, dan instruksi backup
    eksternal.
14. Dokumentasikan deployment lokal dan server.
15. Dokumentasikan reverse proxy HTTPS, cookie Secure, bind address,
    firewall, dan risiko server multi-user.
16. Buat environment sample tanpa secret.
17. Pastikan `data/` dan provider secret config tidak masuk
    image/repository.
18. Uji restart container dan persistensi database/attachment.
19. Uji manual update preparation, migrasi, dan restore.

### Artefak

-   CLI operasional.
-   Dockerfile dan compose file.
-   `docs/operations/installation.md`.
-   `docs/operations/cli.md`.
-   `docs/operations/docker.md`.
-   `docs/operations/backup-restore.md`.
-   `docs/operations/update.md`.

### Tes dan acceptance criteria

-   `rencanaku doctor` menemukan config/permission/data errors.
-   Backup dan restore melalui CLI benar-benar bekerja.
-   Docker restart tidak kehilangan data.
-   Port/bind tidak terbuka lebih luas dari konfigurasi.
-   Update check tidak menginstal update otomatis.
-   Migrasi dapat diuji pada backup/salinan sebelum data aktif diganti.
-   Instalasi bersih terdokumentasi dari nol.

### Checkpoint 10

Jalankan install lokal dan Docker dari direktori/host bersih mengikuti
dokumentasi saja, tanpa bantuan asumsi yang tidak tertulis.

------------------------------------------------------------------------

## 16. Fase 11 --- Hardening, regresi, aksesibilitas, dan rilis

### Tujuan

Membuktikan baseline produk berfungsi secara aman dan dapat dipelihara.

### Tugas

1.  Jalankan semua unit, integration, HTTP, migration, security,
    recovery, dan regression tests.
2.  Tambahkan regression test untuk setiap bug yang ditemukan.
3.  Audit ownership checks untuk setiap resource privat.
4.  Audit CSRF, XSS, path traversal, provider URL/SSRF, upload, secret
    handling, session, dan rate limit.
5.  Uji quota/concurrency provider, cancellation, retry, dan resume.
6.  Uji backup/restore dengan data berukuran representatif.
7.  Uji disk penuh dan permission folder salah.
8.  Audit aksesibilitas keyboard, fokus, contrast, screen-reader
    semantics, dan reduced motion.
9.  Uji layout desktop, tablet, mobile; light/dark; Indonesia/English.
10. Uji pemilihan konteks dengan proyek kecil, sedang, dan besar.
11. Uji bahwa dokumen locked, plan approval, diff approval, task status,
    dan project closure tidak bisa dilewati.
12. Jalankan `npm ci` dari clean checkout.
13. Jalankan CSS build, lint, test, migration tests, audit dependencies,
    dan smoke test.
14. Tinjau semua warning dependency dan catat keputusan.
15. Verifikasi dokumentasi setup, CLI, provider, server, Docker, backup,
    restore, migration, security, troubleshooting, dan dependency
    versions.
16. Buat changelog dan release notes.
17. Jalankan acceptance test mode lokal.
18. Jalankan acceptance test mode server multi-user.
19. Jalankan acceptance test Docker.
20. Siapkan paket rilis dan prosedur rollback.

### Acceptance criteria rilis

-   Tidak ada temuan keamanan kritis/tinggi yang belum ditangani tanpa
    penerimaan risiko eksplisit.
-   Semua tes wajib lulus atau memiliki pengecualian yang disetujui dan
    dicatat.
-   Tidak ada secret di repository/log/export.
-   Backup dan restore diuji.
-   User data isolation dibuktikan melalui tes.
-   Pengguna dapat menyelesaikan alur inti sampai task selesai dan
    proyek ditutup.
-   UI menjelaskan konteks yang dikirim ke provider.
-   Tidak ada AI-generated state yang mengubah keputusan locked tanpa
    approval.
-   Dokumentasi mencerminkan perilaku aktual, bukan rencana yang belum
    dibuat.
-   Pengguna mengonfirmasi kesiapan rilis.

### Checkpoint 11

Release candidate diserahkan untuk pengujian penerimaan. Jangan menyebut
produk siap produksi sebelum tes penerimaan benar-benar dilakukan.

------------------------------------------------------------------------

## 17. Urutan implementasi modul yang disarankan

Untuk menghindari banyak modul setengah jadi, bangun vertical slice
dalam urutan berikut:

1.  **App boot:** Express + EJS + Tailwind + config validation + health
    endpoint.
2.  **Persistensi:** SQLite + migration + repository + file storage.
3.  **Auth:** first-run admin + login + session + CSRF + ownership.
4.  **Project/chat:** project, conversation, messages, dashboard.
5.  **AI vertical slice:** mock adapter → job runner → satu provider
    nyata → hasil tersimpan.
6.  **Context:** memories + decisions + context preview + attachments.
7.  **Documents:** catalog → generation → preview → diff → approval →
    version.
8.  **Plan:** readiness → plan generation → review → approval.
9.  **Tasks/prompts:** dependency graph → prompts → coding-agent target
    format.
10. **Trials:** result report → evidence → acceptance validation →
    follow-up prompts.
11. **Operations:** backup/restore → trash/storage →
    diagnostics/notifications.
12. **Packaging:** CLI → Docker → update preparation → release gates.

Setiap vertical slice harus meliputi UI, domain/use case, persistence,
validasi, authorization, error state, tests, dan dokumentasi.

## 18. Checklist penerimaan produk end-to-end

### Proyek dan memori

-   [ ] Pengguna dapat membuat proyek dari chat kosong.
-   [ ] Proyek dapat diubah nama, diarsipkan, dipulihkan, diduplikasi,
    dan dihapus sesuai retensi.
-   [ ] Duplikasi menyalin data kerja utama, dokumen, plan, tasks,
    attachments, dan memory, tetapi tidak chat history.
-   [ ] Percakapan dan memori terstruktur terpisah.
-   [ ] Konflik dengan keputusan terkunci meminta konfirmasi.

### AI dan provider

-   [ ] Pengguna dapat mengatur provider/model dan menguji koneksi.
-   [ ] Model default dapat diatur per jenis tugas dan di-override.
-   [ ] Context preview menunjukkan data yang benar-benar dikirim.
-   [ ] Job memiliki status, durasi, provider/model, error,
    retry/cancel.
-   [ ] Rate limit dan output invalid ditangani.
-   [ ] Biaya ditampilkan sebagai aktual atau estimasi dengan label yang
    benar.

### Dokumen dan plan

-   [ ] Katalog dokumen dapat dipilih.
-   [ ] Dokumen dapat dibuat, diedit, divalidasi, dan diberi versi.
-   [ ] Diff menampilkan perubahan dan memerlukan persetujuan.
-   [ ] File stale tidak ditimpa tanpa recompute diff.
-   [ ] Readiness check berjalan sebelum plan.
-   [ ] Plan memerlukan approval sebelum prompt resmi dibuat.

### Task dan trial

-   [ ] Task memiliki dependencies dan acceptance criteria.
-   [ ] Siklus dependency ditolak.
-   [ ] Prompt dan revisi terhubung ke task dan versi yang tepat.
-   [ ] Trial menyimpan hasil, bukti, prompt, validasi, dan waktu.
-   [ ] AI tidak menandai task done.
-   [ ] Penutupan proyek membutuhkan pemeriksaan dan konfirmasi.

### Keamanan dan operasi

-   [ ] Admin pertama dibuat hanya sekali.
-   [ ] Password di-hash dan sesi aman.
-   [ ] Ownership checks diuji lintas akun.
-   [ ] API key tidak masuk log/repository/export.
-   [ ] Upload tervalidasi dan tidak dieksekusi.
-   [ ] Backup dan restore diuji dengan konsistensi DB/file.
-   [ ] Storage monitor memberi peringatan tanpa menghapus file aktif.
-   [ ] CLI mendukung operasi yang terdokumentasi.
-   [ ] Update check tidak memasang update otomatis.
-   [ ] Docker memakai volume persisten.
-   [ ] Health/diagnostics dan log redaction bekerja.

### Kualitas dan rilis

-   [ ] Instalasi bersih berhasil.
-   [ ] Dependency lockfile committed.
-   [ ] Semua tes wajib dijalankan dan hasilnya dicatat.
-   [ ] Aksesibilitas dan responsive UI diperiksa.
-   [ ] Dokumentasi teknis diperbarui.
-   [ ] Pengguna menyetujui release candidate.

## 19. Instruksi tugas untuk coding agent

Setiap prompt implementasi yang diberikan kepada coding agent harus
berisi: 1. Nama fase dan task ID. 2. Tujuan yang sempit dan terukur. 3.
Referensi bagian `PRD.md`, `ARCHITECTURE.md`, dan rencana ini. 4.
File/modul yang boleh diperiksa atau diubah. 5. Dependensi task dan
prasyarat yang sudah lulus. 6. Persyaratan teknis dan invarian yang
tidak boleh dilanggar. 7. Acceptance criteria eksplisit. 8. Tes yang
harus dijalankan. 9. Larangan menambah dependency tanpa alasan dan
pemeriksaan kompatibilitas. 10. Larangan menulis rahasia ke source/log.
11. Kewajiban memperbarui dokumentasi. 12. Format laporan akhir: file
berubah, ringkasan, tes beserta hasil nyata, risiko, asumsi, dan
pekerjaan tersisa.

Coding agent harus berhenti dan meminta persetujuan jika menemukan
konflik nyata dengan keputusan yang terkunci atau membutuhkan perubahan
arsitektur besar. Jangan menganggap task selesai hanya karena kode telah
dihasilkan.

## 20. Definisi selesai per task

Task implementasi dianggap siap untuk ditinjau bila: - Tujuan task
terpenuhi. - Acceptance criteria dapat diuji. - Tes yang relevan telah
dijalankan dan hasilnya dicatat. - Tidak ada regresi yang diketahui. -
Validasi, authorization, error handling, dan logging sudah
dipertimbangkan. - Dokumentasi terkait diperbarui. - Tidak ada rahasia
di diff. - Dampak terhadap schema, data, provider, UI, dan modul terkait
diperiksa. - Pekerjaan yang belum selesai dan asumsi dinyatakan secara
eksplisit.

Status akhir task tetap ditentukan pengguna.

## 21. Risiko utama dan mitigasi

  -----------------------------------------------------------------------
  Risiko                              Mitigasi
  ----------------------------------- -----------------------------------
  Dependency major saling tidak cocok Baseline runtime tunggal, lockfile,
                                      `npm ci`, CI, upgrade terpisah

  Native addon SQLite gagal pada      Verifikasi runtime/OS/arsitektur,
  platform                            smoke test, dokumentasi build tools

  Context AI terlalu besar            Context selection, prioritas
                                      relevansi, ringkasan berlapis,
                                      peringatan konteks dihilangkan

  AI mengubah keputusan resmi         Locked decisions, validator,
                                      proposal/diff, approval gate

  Pengguna kehilangan data            Autosave, versioning, backup
                                      konsisten, restore test

  File privat terbuka ke web          Data di luar public root, file ID
                                      internal, auth per resource

  Biaya AI tak terduga                Model selection, usage tracking,
                                      concurrency/rate limits, cost
                                      estimates

  Server multi-user membocorkan data  Ownership checks, security tests,
                                      secret scope, admin-content
                                      separation

  Perubahan plan membuat prompt usang Trace links, impact analysis, stale
                                      marking

  Coding agent mengklaim tes yang     Wajib mencatat command dan hasil
  tidak dijalankan                    nyata, verifikasi pada checkpoint

  Disk penuh merusak aplikasi         Storage monitoring, warning,
                                      cleanup yang tidak menghapus file
                                      aktif

  Restore membuat state campuran      Staging, checksum, DB integrity
                                      check, atomic swap/rollback
  -----------------------------------------------------------------------

## 22. Dokumen operasional yang harus tersedia sebelum rilis

-   `README.md` --- ringkasan produk dan quick start.
-   `docs/decisions/` --- keputusan teknis dan konsekuensinya.
-   `docs/database/schema.md` --- tabel, relasi, indeks, migration
    policy.
-   `docs/providers/` --- konfigurasi provider, privasi, dan
    troubleshooting.
-   `docs/operations/installation.md` --- instalasi bersih.
-   `docs/operations/cli.md` --- perintah CLI.
-   `docs/operations/docker.md` --- Docker dan volume persisten.
-   `docs/operations/backup-restore.md` --- backup, restore, retention,
    recovery.
-   `docs/operations/update.md` --- pemeriksaan update dan instalasi
    manual.
-   `docs/security/threat-model.md` --- ancaman dan mitigasi.
-   `docs/testing/test-strategy.md` --- perintah tes dan test matrix.
-   `docs/troubleshooting.md` --- error umum dan langkah perbaikan.
-   `CHANGELOG.md` --- perubahan per rilis.
-   `LICENSE` --- lisensi proyek ditentukan oleh pemilik proyek sebelum
    distribusi.

------------------------------------------------------------------------

**Prinsip akhir:** bangun fondasi yang dapat diuji terlebih dahulu,
lanjutkan dengan vertical slice yang lengkap, dan hanya tambah
kompleksitas setelah fase sebelumnya stabil. Kualitas implementasi
diukur dari perilaku yang dapat dibuktikan, keamanan data, recovery, dan
keterlacakan---bukan jumlah file atau banyaknya kode yang dihasilkan.
