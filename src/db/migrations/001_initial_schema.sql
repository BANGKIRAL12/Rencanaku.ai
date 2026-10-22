-- Rencanaku.ai — Migrasi 001: skema inti
--
-- Berisi tabel yang disebut ARCHITECTURE §7.1 untuk Fase 2
-- (users, sessions, projects, conversations, messages, app_settings,
-- audit_events) plus `project_members` sebagai tempat izin eksplisit di
-- masa depan tanpa memberi sharing default.
--
-- Konvensi yang dipakai seluruh migrasi:
-- - Primary key bertipe TEXT berisi UUID v4 yang dibuat aplikasi
--   (crypto.randomUUID()), bukan AUTOINCREMENT agar ID tidak dapat
--   ditebak dan stabil saat restore.
-- - Timestamp berupa TEXT ISO-8601 UTC (contoh 2026-10-22T09:18:17.123Z).
--   Aplikasi selalu mengirim nilai eksplisit; DEFAULT hanya jaring
--   pengaman bila ada INSERT di luar repository.
-- - Waktu disimpan UTC; konversi ke zona waktu lokal hanya di UI.
-- - Status memakai CHECK constraint agar nilai di luar daftar ditolak
--   oleh database, bukan hanya oleh validasi aplikasi.
-- - ON DELETE dipakai secara sadar: data penting memakai RESTRICT, data
--   turunan boleh CASCADE. Penghapusan produk selalu lewat trash/retensi.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                    TEXT PRIMARY KEY,
  username              TEXT NOT NULL,
  username_normalized   TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'member')),
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'disabled')),
  must_change_password  INTEGER NOT NULL DEFAULT 0
                          CHECK (must_change_password IN (0, 1)),
  locale                TEXT NOT NULL DEFAULT 'id'
                          CHECK (locale IN ('id', 'en')),
  theme                 TEXT NOT NULL DEFAULT 'system'
                          CHECK (theme IN ('light', 'dark', 'system')),
  last_login_at         TEXT,
  password_changed_at   TEXT,
  created_at            TEXT NOT NULL
                          DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL
                          DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(username) > 0),
  CHECK (length(display_name) > 0)
);

CREATE UNIQUE INDEX ux_users_username_normalized
  ON users (username_normalized);
CREATE INDEX idx_users_status ON users (status);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
-- Disimpan di SQLite, bukan MemoryStore (ARCHITECTURE §6.1/§11.1).
-- `token_hash` adalah SHA-256 dari nilai cookie sesi; nilai cookie asli
-- tidak pernah menyentuh disk. Kolom `data` menyimpan payload JSON untuk
-- adapter express-session, dan `expires_at_unix` disimpan agar store dapat
-- melakukan prune dengan indeks INTEGER.
CREATE TABLE sessions (
  id                 TEXT PRIMARY KEY,
  token_hash         TEXT NOT NULL,
  user_id            TEXT REFERENCES users (id) ON DELETE CASCADE,
  data               TEXT NOT NULL DEFAULT '{}',
  ip_hash            TEXT,
  user_agent         TEXT,
  expires_at         TEXT NOT NULL,
  expires_at_unix    INTEGER NOT NULL,
  last_seen_at       TEXT,
  revoked_at         TEXT,
  created_at         TEXT NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(token_hash) = 64)
);

CREATE UNIQUE INDEX ux_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at_unix);
CREATE INDEX idx_sessions_active ON sessions (expires_at_unix)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
-- `owner_user_id` adalah batas privasi utama: seluruh query proyek pada
-- repository selalu menyaring kolom ini (ARCHITECTURE §2.3, §11.2).
CREATE TABLE projects (
  id                     TEXT PRIMARY KEY,
  owner_user_id          TEXT NOT NULL
                           REFERENCES users (id) ON DELETE RESTRICT,
  name                   TEXT NOT NULL,
  slug                   TEXT NOT NULL,
  description            TEXT,
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'completed', 'archived')),
  lifecycle_state        TEXT NOT NULL DEFAULT 'active'
                           CHECK (lifecycle_state IN ('active', 'trashed')),
  source_project_id      TEXT REFERENCES projects (id) ON DELETE SET NULL,
  archived_at            TEXT,
  completed_at           TEXT,
  trashed_at             TEXT,
  purge_after            TEXT,
  created_at             TEXT NOT NULL
                           DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL
                           DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(name) > 0),
  CHECK (length(slug) > 0),
  -- Status arsip harus konsisten dengan penanda waktunya.
  CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);

CREATE UNIQUE INDEX ux_projects_owner_slug ON projects (owner_user_id, slug);
CREATE INDEX idx_projects_owner_list
  ON projects (owner_user_id, lifecycle_state, status, updated_at);
CREATE INDEX idx_projects_trash ON projects (purge_after)
  WHERE lifecycle_state = 'trashed';

-- ---------------------------------------------------------------------------
-- project_members
-- ---------------------------------------------------------------------------
-- Disiapkan untuk izin eksplisit di masa depan. TIDAK memberi sharing
-- default; baris hanya boleh dibuat lewat use case yang disetujui.
CREATE TABLE project_members (
  project_id    TEXT NOT NULL
                  REFERENCES projects (id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL
                  REFERENCES users (id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'editor'
                  CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at    TEXT NOT NULL
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members (user_id);

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
-- `owner_user_id` didenormalisasi dari projects agar query riwayat percakapan
-- tetap dapat disaring owner tanpa JOIN, dan trigger di bawah menjaga
-- kedua nilai selalu sama.
CREATE TABLE conversations (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL
                       REFERENCES projects (id) ON DELETE CASCADE,
  owner_user_id      TEXT NOT NULL
                       REFERENCES users (id) ON DELETE RESTRICT,
  title              TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'archived')),
  is_default         INTEGER NOT NULL DEFAULT 0
                       CHECK (is_default IN (0, 1)),
  message_count      INTEGER NOT NULL DEFAULT 0
                       CHECK (message_count >= 0),
  last_message_at    TEXT,
  created_at         TEXT NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_conversations_project
  ON conversations (project_id, last_message_at DESC);
CREATE INDEX idx_conversations_owner
  ON conversations (owner_user_id, updated_at DESC);
CREATE UNIQUE INDEX ux_conversations_project_default
  ON conversations (project_id)
  WHERE is_default = 1;

CREATE TRIGGER trg_conversations_owner_matches_project_insert
BEFORE INSERT ON conversations
FOR EACH ROW
WHEN (SELECT owner_user_id FROM projects WHERE id = NEW.project_id) IS NOT NEW.owner_user_id
BEGIN
  SELECT RAISE(ABORT, 'conversation.owner_user_id harus sama dengan owner proyek');
END;

CREATE TRIGGER trg_conversations_owner_matches_project_update
BEFORE UPDATE OF project_id, owner_user_id ON conversations
FOR EACH ROW
WHEN (SELECT owner_user_id FROM projects WHERE id = NEW.project_id) IS NOT NEW.owner_user_id
BEGIN
  SELECT RAISE(ABORT, 'conversation.owner_user_id harus sama dengan owner proyek');
END;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
-- `sequence` memberi urutan stabil di dalam percakapan dan UNIQUE
-- (conversation_id, sequence) mencegah urutan ganda. Kolom `job_id`
-- sengaja belum foreign key karena tabel ai_jobs dibuat pada Fase 5;
-- kolom tetap ada supaya histori percakapan tidak perlu diubah skema.
CREATE TABLE messages (
  id                  TEXT PRIMARY KEY,
  conversation_id     TEXT NOT NULL
                        REFERENCES conversations (id) ON DELETE CASCADE,
  project_id          TEXT NOT NULL
                        REFERENCES projects (id) ON DELETE CASCADE,
  owner_user_id       TEXT NOT NULL
                        REFERENCES users (id) ON DELETE RESTRICT,
  role                TEXT NOT NULL
                        CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  status              TEXT NOT NULL DEFAULT 'complete'
                        CHECK (status IN ('pending', 'streaming', 'complete', 'failed', 'cancelled')),
  content             TEXT NOT NULL DEFAULT '',
  content_format      TEXT NOT NULL DEFAULT 'markdown'
                        CHECK (content_format IN ('markdown', 'text', 'json')),
  sequence            INTEGER NOT NULL CHECK (sequence > 0),
  job_id              TEXT,
  error_code          TEXT,
  safe_error_message  TEXT,
  created_at          TEXT NOT NULL
                        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL
                        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (conversation_id, sequence)
);

CREATE INDEX idx_messages_conversation
  ON messages (conversation_id, sequence);
CREATE INDEX idx_messages_project
  ON messages (project_id, created_at);
CREATE INDEX idx_messages_job ON messages (job_id)
  WHERE job_id IS NOT NULL;

CREATE TRIGGER trg_messages_owner_matches_conversation_insert
BEFORE INSERT ON messages
FOR EACH ROW
WHEN (SELECT owner_user_id FROM conversations WHERE id = NEW.conversation_id)
     IS NOT NEW.owner_user_id
  OR (SELECT project_id FROM conversations WHERE id = NEW.conversation_id)
     IS NOT NEW.project_id
BEGIN
  SELECT RAISE(ABORT, 'message harus memiliki owner dan project yang sama dengan percakapan');
END;

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
-- Hanya untuk preferensi/pengaturan non-rahasia. API key provider TIDAK
-- boleh disimpan di sini: rahasia hanya di `data/config/providers.json`
-- (ARCHITECTURE §6.4, §11.4). Repository menolak is_secret = 1.
-- Kolom `owner_user_id` NULL berarti scope instance.
CREATE TABLE app_settings (
  id                  TEXT PRIMARY KEY,
  scope               TEXT NOT NULL DEFAULT 'instance'
                        CHECK (scope IN ('instance', 'user')),
  owner_user_id       TEXT REFERENCES users (id) ON DELETE CASCADE,
  key                 TEXT NOT NULL,
  value               TEXT NOT NULL,
  value_type          TEXT NOT NULL DEFAULT 'json'
                        CHECK (value_type IN ('json', 'string', 'number', 'boolean')),
  is_secret           INTEGER NOT NULL DEFAULT 0
                        CHECK (is_secret IN (0, 1)),
  updated_by_user_id  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL
                        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL
                        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(key) > 0),
  CHECK (
    (scope = 'instance' AND owner_user_id IS NULL)
    OR (scope = 'user' AND owner_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX ux_app_settings_scope_key
  ON app_settings (scope, IFNULL(owner_user_id, ''), key);
CREATE INDEX idx_app_settings_owner ON app_settings (owner_user_id);

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------
-- Metadata minimum untuk tindakan sensitif. Isi `metadata` WAJIB berupa
-- JSON non-rahasia; logger sudah melakukan redaksi, dan repository
-- menolak kunci yang terlihat seperti rahasia.
CREATE TABLE audit_events (
  id               TEXT PRIMARY KEY,
  actor_user_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_role       TEXT,
  action           TEXT NOT NULL,
  target_type      TEXT,
  target_id        TEXT,
  project_id       TEXT REFERENCES projects (id) ON DELETE SET NULL,
  outcome          TEXT NOT NULL DEFAULT 'success'
                     CHECK (outcome IN ('success', 'failure')),
  ip_hash          TEXT,
  request_id       TEXT,
  metadata         TEXT,
  created_at       TEXT NOT NULL
                     DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(action) > 0)
);

CREATE INDEX idx_audit_events_actor ON audit_events (actor_user_id, created_at);
CREATE INDEX idx_audit_events_action ON audit_events (action, created_at);
CREATE INDEX idx_audit_events_target ON audit_events (target_type, target_id);
CREATE INDEX idx_audit_events_project ON audit_events (project_id, created_at);