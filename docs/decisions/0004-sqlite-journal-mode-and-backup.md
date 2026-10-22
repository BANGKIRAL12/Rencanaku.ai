# 0004. Mode Jurnal SQLite (WAL) dan Strategi Backup

- **Status:** Diterima (Accepted)
- **Tanggal:** 22 Oktober 2026
- **Penulis:** Tim Pengembang Rencanaku.ai
- **Konteks tugas:** Fase 2 (Task ID: F2) — fondasi database dan penyimpanan

## Konteks

Fase 2 memperkenalkan SQLite sebagai satu-satunya database. Mode jurnal default
SQLite (`delete`) mengunci seluruh berkas saat menulis dan memaksa pembaca
menunggu penulis. Rencanaku.ai adalah aplikasi satu proses dengan beberapa
permintaan HTTP bersamaan, ditambah pekerjaan AI yang berjalan lama dan menulis
checkpoint ke database. Pola tersebut membutuhkan pembacaan yang tetap berjalan
saat ada penulisan.

Sekaligus muncul pertanyaan backup: SQLite menyimpan data di beberapa berkas
(`app.sqlite`, `app.sqlite-wal`, `app.sqlite-shm`). Menyalin hanya
`app.sqlite` saat WAL aktif dapat menghasilkan backup yang kehilangan transaksi
terakhir atau, lebih buruk, salinan yang tampak valid tetapi tidak konsisten.
`ARCHITECTURE §7` dan `implementation_plan §7` mewajibkan backup/restore diuji
dan tidak boleh mencampur state lama dan baru.

## Opsi yang Dipertimbangkan

### A. Mode jurnal

1. **`delete` (default SQLite).** Paling sederhana dan aman di semua
   filesystem, tetapi penulis memblokir pembaca. Tidak cocok untuk aplikasi
   dengan pembacaan sering dan penulisan latar belakang.
2. **`wal` (Write-Ahead Logging).** Pembaca dan penulis tidak saling
   memblokir; commit lebih cepat. Membutuhkan filesystem yang mendukung
   locking bersama (bukan beberapa mount jaringan) dan menghasilkan berkas
   `-wal`/`-shm`.
3. **`memory`.** Tidak tahan crash; hanya untuk database sementara.

### B. Strategi backup

1. **Salin berkas dengan `cp`.** Cepat, tetapi tidak konsisten bila ada
   penulisan bersamaan. Hanya benar setelah `wal_checkpoint(TRUNCATE)` dan
   tanpa penulis aktif.
2. **`.backup` / `VACUUM INTO` lewat API SQLite.** Menghasilkan satu berkas
   konsisten tanpa menghentikan pembaca; SQLite menangani snapshot.
3. **Dump SQL (`sqlite3 .dump`).** Portabel tetapi lambat dan kehilangan
   detail fisik; tidak diperlukan untuk instalasi satu mesin.

## Keputusan

1. **Mode jurnal default `wal`**, dapat diubah lewat `SQLITE_JOURNAL_MODE`.
   Nilai divalidasi Zod (`wal`, `delete`, `truncate`, `persist`, `memory`).
   Koneksi juga menetapkan:
   - `synchronous = NORMAL` — cukup aman untuk WAL dan jauh lebih cepat
     daripada `FULL`;
   - `temp_store = MEMORY`;
   - `busy_timeout = SQLITE_BUSY_TIMEOUT_MS` (default 5000 ms);
   - `foreign_keys = ON` pada **setiap** koneksi.
2. **`PRAGMA journal_mode = WAL` tidak dapat diterapkan pada database
   in-memory.** `openDatabase()` melewati pragma tersebut untuk `:memory:` dan
   melaporkan mode sebenarnya lewat `describeConnection()`; jangan menganggap
   WAL aktif tanpa membaca hasil pragma.
3. **Penutupan koneksi menjalankan `wal_checkpoint(TRUNCATE)` lebih dulu.**
   Dengan begitu berkas `-wal` kosong saat proses berhenti normal sehingga
   salinan direktori setelah shutdown tidak kehilangan data.
4. **Backup wajib memakai API SQLite** (`VACUUM INTO` atau backup API
   `better-sqlite3`), bukan penyalinan berkas mentah, kecuali proses sudah
   berhenti dan checkpoint sudah dijalankan. Berkas `-wal` dan `-shm` tidak
   boleh disalin terpisah sebagai "backup".
5. **Backup tidak pernah ditulis ke `public/`.** Lokasi default
   `DATA_DIR/backups` (gitignored, izin 0700/0600).
6. **Restore diuji sebagai operasi utuh:** hentikan proses, pulihkan berkas
   database + direktori file, jalankan `npm run db:check`, lalu verifikasi
   checksum file. Mencampur database lama dengan file baru (atau sebaliknya)
   dilarang karena akan menghasilkan record aktif tanpa byte atau byte tanpa
   metadata.

## Konsekuensi

- Pembacaan tetap berjalan saat pekerjaan AI menulis checkpoint; risiko
  `SQLITE_BUSY` berkurang berkat `busy_timeout`.
- Direktori `data/` harus berada di filesystem lokal. Bila operator memakai
  mount jaringan, `SQLITE_JOURNAL_MODE=delete` adalah pilihan sadar yang harus
  didokumentasikan; WAL pada NFS dapat merusak database.
- `synchronous = NORMAL` berarti commit terakhir dapat hilang saat listrik
  mati, tetapi database tetap konsisten (tidak korup). Ini trade-off yang
  diterima untuk aplikasi perencanaan, bukan sistem keuangan.
- Backup/restore penuh (Fase 9) harus memakai keputusan ini, bukan menyalin
  berkas secara manual.
