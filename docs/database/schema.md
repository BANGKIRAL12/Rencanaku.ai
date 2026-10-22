# Skema Database Rencanaku.ai

Dokumen ini adalah rujukan operasional untuk skema SQLite pada Fase 2. Sumber
kebenaran tetap berkas migrasi di `src/db/migrations/`; dokumen ini menjelaskan
**mengapa** bentuknya seperti itu dan **bagaimana** mengubahnya dengan aman.

- Mesin: SQLite melalui `better-sqlite3` (native addon, sinkron).
- Berkas: `DATA_DIR/app.sqlite` (default `data/app.sqlite`).
- Versi skema saat ini: **2** (`001_initial_schema`, `002_stored_files`).
- Kode terkait: `src/db/connection.js`, `src/db/migrate.js`,
  `src/db/transaction.js`, `src/db/repositories/`.

## Prinsip Umum

1. **Semua SQL hanya di repository.** Route, use case, dan view tidak pernah
   menulis SQL. `src/db/repositories/` adalah satu-satunya tempat prepared
   statement.
2. **ID berupa UUID v4 TEXT** yang dibuat aplikasi (`crypto.randomUUID()`),
   bukan `AUTOINCREMENT`, agar ID tidak dapat ditebak dan tetap stabil saat
   backup/restore.
3. **Waktu disimpan sebagai TEXT ISO-8601 UTC** (`2026-10-22T09:18:17.123Z`).
   Konversi zona waktu hanya dilakukan di UI.
4. **Nilai terbatas memakai `CHECK constraint`.** Database ikut menolak nilai
   di luar daftar, bukan hanya validasi aplikasi.
5. **`ON DELETE` dipilih sadar:** data milik pengguna memakai `RESTRICT`
   (tidak boleh hilang diam-diam), data turunan memakai `CASCADE`, dan
   referensi audit memakai `SET NULL`.
6. **Setiap koneksi menjalankan `PRAGMA foreign_keys = ON`.** Lihat
   `openedDatabase` di `src/db/connection.js`; jangan membuka `better-sqlite3`
   langsung dari modul lain.

## Tabel

### `users`

Akun pengguna. Satu-satunya tabel yang menyimpan hash password.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 |
| `username` | TEXT | Nama tampilan login (asli) |
| `username_normalized` | TEXT | `lower(trim(username))`, unik |
| `display_name` | TEXT | Nama yang ditampilkan |
| `password_hash` | TEXT | `crypto.scrypt` (format `scrypt$N=...$r=...$p=...$salt$hash`) |
| `role` | TEXT | `admin` \| `member` |
| `status` | TEXT | `active` \| `disabled` |
| `must_change_password` | INTEGER | 0/1 |
| `locale` | TEXT | `id` \| `en` |
| `theme` | TEXT | `light` \| `dark` \| `system` |
| `last_login_at`, `password_changed_at` | TEXT | NULL sampai terjadi |
| `created_at`, `updated_at` | TEXT | ISO-8601 UTC |

Indeks: `ux_users_username_normalized` (unik), `idx_users_status`.

Aturan: `findById()` mengembalikan bentuk publik **tanpa** `password_hash`.
Hanya `findAuthRecordById()` / `findAuthRecordByUsername()` yang memuat hash,
dan keduanya hanya boleh dipakai lapisan autentikasi.

### `sessions`

Sesi login disimpan di SQLite, **bukan** `MemoryStore` (ARCHITECTURE §6.1).

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 |
| `token_hash` | TEXT | SHA-256 dari cookie sesi; nilai mentah tidak pernah disimpan |
| `user_id` | TEXT FK → `users` | `ON DELETE CASCADE`, NULL untuk sesi pra-login |
| `data` | TEXT | Payload JSON (mis. token CSRF) |
| `ip_hash`, `user_agent` | TEXT | Untuk audit; IP di-hash |
| `expires_at` | TEXT | ISO-8601 |
| `expires_at_unix` | INTEGER | Untuk prune cepat dan indeks |
| `last_seen_at`, `revoked_at` | TEXT | NULL bila belum |

Indeks: `ux_sessions_token_hash` (unik), `idx_sessions_user`,
`idx_sessions_expires`, `idx_sessions_active` (parsial, `revoked_at IS NULL`).

`CHECK (length(token_hash) = 64)` memastikan hanya digest SHA-256 yang masuk.

### `projects`

Batas privasi utama: setiap query proyek wajib menyaring `owner_user_id`.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 |
| `owner_user_id` | TEXT FK → `users` | `ON DELETE RESTRICT` |
| `name`, `slug` | TEXT | Slug unik per pemilik (`ux_projects_owner_slug`) |
| `description` | TEXT | NULL boleh |
| `status` | TEXT | `active` \| `completed` \| `archived` |
| `lifecycle_state` | TEXT | `active` \| `trashed` |
| `source_project_id` | TEXT FK → `projects` | Untuk duplikasi; `SET NULL` |
| `archived_at`, `completed_at`, `trashed_at`, `purge_after` | TEXT | Konsisten dengan status |

`CHECK ((status = 'archived') = (archived_at IS NOT NULL))` memaksa repository
selalu mengisi/mengosongkan `archived_at` bersama status.

### `project_members`

Disiapkan untuk izin eksplisit di masa depan. **Tidak** memberi sharing
default: baris hanya boleh dibuat lewat use case yang disetujui.

PK gabungan `(project_id, user_id)`; `role` ∈ `owner`/`editor`/`viewer`;
keduanya `ON DELETE CASCADE`.

### `conversations`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 |
| `project_id` | TEXT FK → `projects` | `ON DELETE CASCADE` |
| `owner_user_id` | TEXT FK → `users` | `ON DELETE RESTRICT`; denormalisasi owner proyek |
| `title` | TEXT | NULL = percakapan tanpa judul |
| `status` | TEXT | `active` \| `archived` |
| `is_default` | INTEGER | 0/1; unik per proyek lewat indeks parsial |
| `message_count`, `last_message_at` | INTEGER/TEXT | Statistik ringan untuk daftar |

Indeks: `idx_conversations_project`, `idx_conversations_owner`, dan
`ux_conversations_project_default` (unik parsial `WHERE is_default = 1`).

Trigger `trg_conversations_owner_matches_project_insert` dan
`..._update` menolak percakapan yang owner-nya berbeda dari owner proyek.

### `messages`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 |
| `conversation_id` | TEXT FK → `conversations` | `ON DELETE CASCADE` |
| `project_id` | TEXT FK → `projects` | `ON DELETE CASCADE`, dijaga trigger |
| `owner_user_id` | TEXT FK → `users` | `ON DELETE RESTRICT` |
| `role` | TEXT | `user` \| `assistant` \| `system` \| `tool` |
| `status` | TEXT | `pending` \| `streaming` \| `complete` \| `failed` \| `cancelled` |
| `content`, `content_format` | TEXT | `markdown` \| `text` \| `json` |
| `sequence` | INTEGER | `> 0`, unik per percakapan |
| `job_id` | TEXT | Diisi Fase 5; belum FK ke `ai_jobs` |
| `error_code`, `safe_error_message` | TEXT | Pesan aman untuk ditampilkan |

`UNIQUE (conversation_id, sequence)` mencegah urutan ganda. Repository
`createWithSequence` menghitung `MAX(sequence) + 1` di dalam transaksi.

Trigger `trg_messages_owner_matches_conversation_insert` memastikan
`owner_user_id` dan `project_id` pesan sama dengan percakapan induknya.

### `app_settings`

Preferensi non-rahasia. **API key provider tidak boleh disimpan di sini**
(ARCHITECTURE §6.4/§11.4); rahasia hanya di `data/config/providers.json`.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 |
| `scope` | TEXT | `instance` \| `user` |
| `owner_user_id` | TEXT FK → `users` | Wajib NULL untuk `instance`, wajib terisi untuk `user` |
| `key` | TEXT | Tidak kosong |
| `value` | TEXT | Serialisasi (string/number/boolean/JSON) |
| `value_type` | TEXT | `json` \| `string` \| `number` \| `boolean` |
| `is_secret` | INTEGER | Selalu 0; repository menolak nilai 1 |
| `updated_by_user_id` | TEXT FK → `users` | `ON DELETE SET NULL` |

Keunikan: `ux_app_settings_scope_key` pada
`(scope, IFNULL(owner_user_id, ''), key)` sehingga `NULL` tetap terhitung.
Repository melempar `SETTINGS_SECRET_FORBIDDEN` bila `isSecret` truthy.

### `audit_events`

Jejak tindakan sensitif (login, perubahan proyek, ekspor, tindakan admin).

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 |
| `actor_user_id` | TEXT FK → `users` | `ON DELETE SET NULL` |
| `actor_role` | TEXT | Peran saat tindakan terjadi |
| `action` | TEXT | Tidak kosong, mis. `project.view` |
| `target_type`, `target_id` | TEXT | Objek yang terdampak |
| `project_id` | TEXT FK → `projects` | `ON DELETE SET NULL` |
| `outcome` | TEXT | `success` \| `failure` |
| `ip_hash`, `request_id` | TEXT | Korelasi dengan log, tanpa IP mentah |
| `metadata` | TEXT | JSON non-rahasia |

Repository menolak kunci metadata yang menyerupai rahasia (`apiKey`,
`password`, `authorization`, `clientSecret`, …) dengan
`AUDIT_METADATA_FORBIDDEN`.

### `stored_files`

Metadata file fisik. Isi file **tidak** disimpan di database; hanya path
relatif dan checksum. Dibuat di migrasi 002 karena dibutuhkan oleh
`FileStorageService` (lihat ADR 0005).

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4; juga nama file internal |
| `owner_user_id` | TEXT FK → `users` | `ON DELETE RESTRICT` |
| `project_id` | TEXT FK → `projects` | `ON DELETE SET NULL` |
| `scope` | TEXT | `attachment`, `document_version`, `trial_artifact`, `export`, `other` |
| `state` | TEXT | `pending` \| `active` \| `deleted` |
| `original_name` | TEXT | Hanya metadata tampilan, tidak pernah jadi path |
| `relative_path` | TEXT | Unik; relatif terhadap root penyimpanan |
| `size_bytes` | INTEGER | `>= 0` |
| `hash_algorithm` | TEXT | Hanya `sha256` |
| `content_hash` | TEXT | Hex digest |
| `mime_type` | TEXT | Default `application/octet-stream` |
| `extension` | TEXT | Termasuk titik, mis. `.pdf` |
| `deleted_at` | TEXT | Wajib terisi saat `state = 'deleted'` |

`CHECK` penting:

- `state = 'active'` ⇒ `deleted_at IS NULL` dan `size_bytes > 0`;
- `state = 'deleted'` ⇒ `deleted_at IS NOT NULL`.

## Invarian File/DB

Urutan operasi di `src/modules/storage/file-storage.js`:

1. **Simpan:** tulis byte ke `data/temp/<uuid>.part` (mode 0600) sambil
   menghitung hash/ukuran → `fsync` → `rename` atomik ke `data/files/ab/cd/...`
   → baru `INSERT` record `active`. Bila `INSERT` gagal, file final dihapus
   (kompensasi) sehingga tidak ada file tanpa metadata.
2. **Hapus:** ubah record menjadi `deleted` lebih dulu, baru hapus byte.
   Kegagalan menghapus byte hanya menghasilkan file yatim yang aman dan
   dilaporkan `npm run db:check`.
3. **Baca:** record harus `active` dan path harus tetap di dalam root file
   (`resolveExistingWithinRoot`, termasuk pemeriksaan symlink).

Konsekuensi: tidak pernah ada record `active` yang menunjuk file yang tidak
ada; yang mungkin terjadi hanyalah file yatim, yang sifatnya konservatif.

## Migrasi

- Berkas: `src/db/migrations/NNN_nama_unik.sql`, pola `^\d{3}_[a-z0-9_]+\.sql$`.
- Nomor harus berurutan dan tidak boleh dipakai ulang.
- `schema_migrations` dibuat oleh runner, bukan oleh migrasi, dan menyimpan
  `id`, `checksum` (SHA-256 isi berkas), `applied_at`, `app_version`,
  `duration_ms`.
- `runMigrations()` memverifikasi checksum berkas yang sudah diterapkan
  **sebelum** menerapkan yang baru. Mengubah berkas yang sudah dirilis
  melempar `MigrationChecksumError`; menghapusnya melempar
  `MIGRATION_FILE_MISSING`.
- Setiap migrasi dijalankan di dalam satu transaksi. SQL yang gagal di tengah
  tidak meninggalkan tabel maupun baris riwayat.
- Migrasi harus bekerja dari database kosong **dan** dari versi sebelumnya;
  keduanya diuji di `test/integration/migrations.test.js`.

### Menambah migrasi baru

1. Buat `src/db/migrations/003_<nama>.sql` berisi perubahan maju (tidak ada
   `DOWN`; pemulihan dilakukan lewat backup/restore, bukan rollback otomatis).
2. Tambahkan repository/tes yang membutuhkan kolom baru.
3. Naikkan `SUPPORTED_SCHEMA_VERSION` di `src/db/connection.js` bila skema
   berubah.
4. Jalankan `npm run db:migrate`, lalu `npm run db:check`, `npm test`, dan
   `npm run build:css` bila ada perubahan UI.
5. Jangan pernah mengedit migrasi yang sudah ada di lingkungan nyata; buat
   migrasi baru.

## Pemeriksaan Kesehatan

```bash
npm run db:migrate   # terapkan migrasi yang tertunda
npm run db:check     # PRAGMA, FK, migrasi, checksum file, izin direktori
npm run doctor       # runtime, better-sqlite3, konfigurasi repo
```

`npm run db:check` menjalankan `PRAGMA integrity_check`,
`PRAGMA foreign_key_check`, memeriksa bahwa setiap record aktif punya byte,
membandingkan checksum, mencari file yatim, dan memeriksa izin direktori data
(0700). Keluar dengan kode 1 bila ada pemeriksaan berstatus `fail`; file yatim
dan record `pending` hanya menjadi peringatan.

## Repository

| Repository | Tabel | Catatan keamanan |
| --- | --- | --- |
| `users` | `users` | Hash hanya lewat `findAuthRecord*` |
| `sessions` | `sessions` | Hash token dihitung di repository |
| `projects` | `projects` | Semua method publik menerima `ownerUserId` |
| `conversations` | `conversations` | `findOwned`, `listByProject` menyaring owner |
| `messages` | `messages` | `findOwned`, `listByConversation` menyaring owner |
| `settings` | `app_settings` | Menolak `isSecret` |
| `audit` | `audit_events` | Menolak metadata mirip rahasia |
| `storedFiles` | `stored_files` | `findOwned`; `findByIdForSystem` hanya untuk pemeriksaan sistem |

Semua repository dibuat lewat `createRepositories(db)` di
`src/db/repositories/index.js`. Bundle lengkap hanya dapat dibuat setelah
skema berada pada versi terbaru, karena prepared statement disiapkan saat
pembuatan (lihat `src/db/container.js`: migrasi lebih dulu, repository
sesudahnya).
