# 0005. Direktori Data Privat dan Penyimpanan File

- **Status:** Diterima (Accepted)
- **Tanggal:** 22 Oktober 2026
- **Penulis:** Tim Pengembang Rencanaku.ai
- **Konteks tugas:** Fase 2 (Task ID: F2) — fondasi database dan penyimpanan

## Konteks

Aplikasi menyimpan dua jenis data sensitif: **database** (isi percakapan,
keputusan proyek, audit) dan **file** (lampiran, dokumen, hasil ekspor). Semua
itu milik pengguna dan wajib privat. Fase 1 hanya memiliki root statis
`public/assets` yang disajikan Express. Fase 2 harus menambahkan penyimpanan
tanpa membuka celah agar data privat dapat diunduh lewat HTTP, dan tanpa
membuat file pengguna menjadi nama path di filesystem.

Masalah yang perlu diputuskan:

1. Di mana data disimpan dan bagaimana path-nya divalidasi?
2. Bagaimana file diberi nama di disk?
3. Bagaimana menjaga konsistensi antara record database dan byte file?
4. Bagaimana mencegah path traversal dan symlink escape?

## Opsi yang Dipertimbangkan

### A. Lokasi data

1. **`data/` di dalam repositori, beberapa subdirektori.** Sederhana untuk
   pengembangan, tetapi mudah tidak sengaja tersaji atau ter-commit.
2. **Satu akar `DATA_DIR` dengan subdirektori tetap**, default `data/` di root
   repo, dapat diarahkan ke `/srv/rencanaku/data` lewat env. Satu env
   mengendalikan semuanya.
3. **Penyimpanan terpisah per jenis (DB di satu tempat, file di tempat lain).**
   Fleksibel, tetapi menambah variabel dan risiko salah konfigurasi.

### B. Nama file di disk

1. **Nama asli dari pengguna.** Ramah dibaca, tetapi membuka path traversal,
   tabrakan nama, encoding aneh, dan kebocoran metadata lewat `ls`.
2. **UUID internal + ekstensi yang disanitasi.** Tidak dapat ditebak, tidak
   pernah memakai input pengguna sebagai path, dan tetap mempertahankan
   ekstensi untuk tooling.

### C. Urutan operasi file/DB

1. **Tulis record dulu, lalu file.** Record aktif sementara bisa menunjuk file
   yang belum ada — melanggar invariant.
2. **Tulis file dulu, lalu record.** Bila pencatatan gagal, tersisa file tanpa
   metadata (yatim). Aman bila file dihapus sebagai kompensasi.
3. **Tulis file dulu, lalu record, dengan kompensasi eksplisit.** File final
   hanya dibuat setelah byte lengkap; kegagalan DB menghapus file.

## Keputusan

1. **Satu akar data: `DATA_DIR`.**
   - Subdirektori tetap: `files/`, `projects/`, `backups/`, `logs/`, `temp/`,
     `config/`.
   - `DATABASE_URL` default `file:app.sqlite` dan `FILE_STORAGE_PATH` default
     `files`, keduanya relatif terhadap `DATA_DIR`; path absolut diterima
     untuk deployment server.
   - `DATA_DIR` wajib berada **di luar `public/`**. `createApp()` memanggil
     `assertDataPathsArePrivate()` saat boot dan menolak konfigurasi yang
     menaruh database, file, atau subdirektori data di dalam root statis.
   - Subdirektori data tidak boleh saling bersarang; `temp/` dan `files/`
     sengaja dipisah agar berkas sementara tidak dianggap file yatim.
2. **Hanya `public/assets` yang disajikan `express.static`.** Tidak ada mount
   statis untuk `data/`. `test/integration/static-isolation.test.js`
   membuktikan file data tidak dapat diunduh, termasuk lewat percobaan
   traversal.
3. **Izin ketat:** direktori data 0700, file privat 0600. Diperiksa ulang oleh
   `ensureDataDirectories()` karena `umask` dapat melonggarkan `mkdir`.
4. **Nama file di disk = UUID internal + ekstensi yang disanitasi**, dengan
   sharding dua level (`ab/cd/<uuid>.pdf`). Nama asli, MIME, ukuran, dan hash
   hanya metadata di `stored_files`.
5. **Semua path dari input pengguna melewati `src/core/utils/safe-path.js`:**
   - `normalizeRelativePath()` menolak path kosong, NUL, absolut, prefiks
     drive Windows, dan segmen `..`;
   - `resolveWithinRoot()` memastikan hasil resolusi tetap di dalam root;
   - `resolveExistingWithinRoot()` juga menolak symlink yang menunjuk keluar
     root (memakai `realpath`).
6. **Urutan simpan:** tulis ke `data/temp/<uuid>.part` (0600) sambil
   menghitung SHA-256 dan ukuran → `fsync` → `rename` atomik ke path final →
   `INSERT` record `active` di dalam transaksi. Bila `INSERT` gagal, file
   final dihapus (`FILE_REGISTER_FAILED`) sehingga tidak ada file tanpa
   metadata dan tidak ada record aktif tanpa byte.
7. **Urutan hapus:** ubah record menjadi `deleted` lebih dulu, baru hapus
   byte. Kegagalan menghapus byte hanya menghasilkan file yatim yang aman dan
   dilaporkan oleh pemeriksaan integritas.
8. **Batas ukuran per file** default 25 MiB (`DEFAULT_MAX_FILE_BYTES`),
   diterapkan saat streaming sehingga file besar tidak pernah ditulis penuh.
   Kuota total per pengguna adalah pekerjaan Fase 6/9, bukan Fase 2.
9. **Checksum SHA-256 wajib.** Nilai `content_hash` disimpan di database dan
   diverifikasi ulang oleh `db:check` serta `FileStorageService.verify()`.
10. **File yatim tidak dihapus otomatis.** Pemeriksaan hanya melaporkan;
    penghapusan otomatis berisiko menghapus file yang sedang ditulis proses
    lain.

## Konsekuensi

- `data/` dan seluruh isinya masuk `.gitignore`; `opencode.jsonc` dan `.env`
  tetap tidak boleh di-commit.
- Operator harus membackup `DATA_DIR` sebagai satu kesatuan (database +
  `files/`), dengan prosedur di ADR 0004.
- Nama file di disk tidak lagi dapat dibaca manusia; dukungan operasional
  memakai `stored_files.original_name` dan `relative_path`.
- Karena `rename` atomik hanya dijamin pada filesystem yang sama,
  `data/temp` dan `data/files` harus berada di satu filesystem. Bila berbeda,
  layanan memakai fallback salin+rename dan mencatat peringatan.
- Setiap endpoint unduh wajib memakai `resolveForRead(fileId, ownerUserId)`
  dengan `ownerUserId` dari sesi server, bukan dari parameter request.
- Risiko yang tersisa: file yatim dapat menumpuk bila penghapusan byte terus
  gagal; ini terlihat di `npm run db:check` dan ditangani manual, bukan
  diam-diam.
