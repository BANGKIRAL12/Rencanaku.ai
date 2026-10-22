-- Rencanaku.ai — Migrasi 002: metadata file tersimpan
--
-- Tabel ini dibuat terpisah dari 001 karena diperkenalkan pada tugas
-- FileStorageService (implementation_plan.md §7 tugas 10-13). Tabel ini
-- yang membuat invariant "tidak ada record aktif yang menunjuk file yang
-- tidak ada" dapat ditegakkan: status `active` hanya boleh ditulis
-- setelah byte file selesai ditulis secara atomik, dan penghapusan
-- menandai record lebih dulu sebelum menghapus byte di disk.
--
-- Isi file tidak pernah disimpan di database; database hanya menyimpan
-- metadata dan path relatif yang sudah dibatasi root (ADR 0005).

CREATE TABLE stored_files (
  id                TEXT PRIMARY KEY,
  owner_user_id     TEXT NOT NULL
                      REFERENCES users (id) ON DELETE RESTRICT,
  project_id        TEXT REFERENCES projects (id) ON DELETE SET NULL,
  scope             TEXT NOT NULL DEFAULT 'attachment'
                      CHECK (scope IN (
                        'attachment', 'document_version', 'trial_artifact',
                        'export', 'other')),
  state             TEXT NOT NULL DEFAULT 'pending'
                      CHECK (state IN ('pending', 'active', 'deleted')),
  -- Nama asli hanya metadata tampilan; tidak pernah dipakai sebagai path.
  original_name     TEXT NOT NULL,
  -- Path relatif terhadap root penyimpanan file, mis. `ab/cd/<uuid>.png`.
  -- UNIQUE karena satu path hanya boleh dimiliki satu record.
  relative_path     TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL DEFAULT 0
                      CHECK (size_bytes >= 0),
  hash_algorithm    TEXT NOT NULL DEFAULT 'sha256'
                      CHECK (hash_algorithm IN ('sha256')),
  content_hash      TEXT NOT NULL,
  mime_type         TEXT NOT NULL DEFAULT 'application/octet-stream',
  extension         TEXT,
  created_at        TEXT NOT NULL
                      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL
                      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at        TEXT,
  CHECK (length(original_name) > 0),
  CHECK (length(relative_path) > 0),
  -- Invariant utama file/DB:
  -- - record aktif tidak boleh ditandai terhapus,
  -- - record terhapus wajib punya waktu penghapusan,
  -- - record aktif wajib sudah punya ukuran final (bukan placeholder 0
  --   pada state pending).
  CHECK (NOT (state = 'active' AND deleted_at IS NOT NULL)),
  CHECK (NOT (state = 'deleted' AND deleted_at IS NULL)),
  CHECK (NOT (state = 'active' AND size_bytes <= 0))
);

CREATE UNIQUE INDEX ux_stored_files_relative_path
  ON stored_files (relative_path);
CREATE INDEX idx_stored_files_owner
  ON stored_files (owner_user_id, created_at DESC);
CREATE INDEX idx_stored_files_project
  ON stored_files (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX idx_stored_files_state ON stored_files (state);
CREATE INDEX idx_stored_files_scope
  ON stored_files (scope, state, created_at DESC);