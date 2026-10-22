import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MIGRATIONS_DIR,
  MigrationChecksumError,
  MigrationError,
  getMigrationStatus,
  listAppliedMigrations,
  loadMigrations,
  runMigrations,
  verifyAppliedMigrations,
} from '../../src/db/migrate.js';
import { openDatabase } from '../../src/db/connection.js';
import { createUsersRepository } from '../../src/db/repositories/users.repository.js';
import { createTestWorkspace } from '../helpers/data.js';

const TEMP_BASE = fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir();

/** Nama tabel yang harus ada setelah seluruh migrasi diterapkan. */
const EXPECTED_TABLES = [
  'app_settings',
  'audit_events',
  'conversations',
  'messages',
  'project_members',
  'projects',
  'schema_migrations',
  'sessions',
  'stored_files',
  'users',
];

describe('Migrasi database kosong', () => {
  let workspace;
  let db;

  beforeAll(() => {
    workspace = createTestWorkspace({ migrate: false });
    db = workspace.db;
  });

  afterAll(() => workspace.cleanup());

  it('membuat tabel schema_migrations sebelum migrasi apa pun', () => {
    // `schema_migrations` dibuat runner, bukan migrasi, agar tetap ada
    // walau belum ada migrasi yang diterapkan.
    const status = getMigrationStatus(db);
    expect(status.pending.map((m) => m.id)).toEqual(['001_initial_schema', '002_stored_files']);
    expect(listAppliedMigrations(db)).toHaveLength(0);
  });

  it('menjalankan migrasi dari database kosong', () => {
    const result = runMigrations(db, { appVersion: '1.0.0' });
    expect(result.applied).toEqual(['001_initial_schema', '002_stored_files']);
    expect(result.skipped).toEqual([]);
  });

  it('membuat seluruh tabel yang diwajibkan Fase 2', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);

    expect(tables).toEqual(EXPECTED_TABLES);
  });

  it('mencatat checksum, waktu, dan durasi tiap migrasi', () => {
    const applied = listAppliedMigrations(db);
    expect(applied).toHaveLength(2);
    for (const row of applied) {
      expect(row.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(Number.isFinite(Date.parse(row.applied_at))).toBe(true);
      expect(typeof row.execution_ms).toBe('number');
      expect(row.app_version).toBe('1.0.0');
    }
  });

  it('hanya menjalankan migrasi yang belum diterapkan saat dipanggil ulang', () => {
    const result = runMigrations(db);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(['001_initial_schema', '002_stored_files']);
    expect(listAppliedMigrations(db)).toHaveLength(2);
  });

  it('PRAGMA integrity_check lulus pada database hasil migrasi', () => {
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });

  it('semua CHECK constraint menutupi kolom status', () => {
    // Nilai status di luar daftar harus ditolak database, bukan aplikasi.
    const userId = 'u-constraint-1';
    db.prepare(
      `INSERT INTO users (id, username, username_normalized, display_name, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, 'constraint', 'constraint', 'Constraint', 'hash');

    expect(() =>
      db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(userId),
    ).toThrow(/CHECK constraint failed/);

    expect(() =>
      db.prepare("UPDATE users SET status = 'dihapus' WHERE id = ?").run(userId),
    ).toThrow(/CHECK constraint failed/);
  });
});

describe('Migrasi dari versi skema sebelumnya', () => {
  /** @type {{cleanup: () => void}[]} */
  const created = [];

  afterAll(() => created.forEach((w) => w.cleanup()));

  it('menerapkan 001 lalu 002 pada database yang sudah berisi data', () => {
    const workspace = createTestWorkspace({ migrate: false });
    created.push(workspace);
    const db = workspace.db;

    // Versi lama: hanya migrasi 001 yang dikenal aplikasi.
    const first = runMigrations(db, { upTo: '001_initial_schema' });
    expect(first.applied).toEqual(['001_initial_schema']);

    const statusBefore = getMigrationStatus(db);
    expect(statusBefore.currentVersion).toBe('001_initial_schema');
    expect(statusBefore.pending.map((m) => m.id)).toEqual(['002_stored_files']);
    expect(statusBefore.upToDate).toBe(false);

    // Data pengguna nyata harus tetap utuh setelah upgrade.
    // Catatan: repository bundle lengkap baru dapat dibuat setelah skema
    // mencapai versi terbaru, jadi di sini dipakai repository users saja.
    const users = createUsersRepository(db);
    users.create({
      username: 'SebelumUpgrade',
      displayName: 'Pengguna Lama',
      passwordHash: 'scrypt$fake$hash',
    });
    expect(users.count()).toBe(1);

    const upgraded = runMigrations(db, { appVersion: '1.1.0' });
    expect(upgraded.applied).toEqual(['002_stored_files']);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    expect(tables).toContain('stored_files');
    expect(users.count()).toBe(1);
    expect(getMigrationStatus(db).upToDate).toBe(true);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
  });

  it('mendeteksi versi skema yang lebih lama ketika file database disalin', () => {
    const source = createTestWorkspace({ migrate: false });
    created.push(source);
    runMigrations(source.db, { upTo: '001_initial_schema' });

    // Salin file database dengan aman (checkpoint WAL lebih dulu).
    source.db.pragma('wal_checkpoint(TRUNCATE)');
    source.db.close();

    const copyPath = path.join(source.root, 'salinan', 'app.sqlite');
    fs.mkdirSync(path.dirname(copyPath), { recursive: true });
    fs.copyFileSync(source.paths.database.path, copyPath);

    const copyDb = openDatabase({ databasePath: copyPath, journalMode: 'wal' });
    try {
      const status = getMigrationStatus(copyDb);
      expect(status.currentVersion).toBe('001_initial_schema');
      expect(status.pending).toHaveLength(1);

      const result = runMigrations(copyDb);
      expect(result.applied).toEqual(['002_stored_files']);
      expect(getMigrationStatus(copyDb).upToDate).toBe(true);
      expect(copyDb.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      copyDb.close();
    }
  });
});

describe('Integritas migrasi', () => {
  /** @type {{cleanup: () => void}[]} */
  const created = [];

  afterAll(() => created.forEach((w) => w.cleanup()));

  function workspaceWithTempMigrations(files) {
    const workspace = createTestWorkspace({ migrate: false });
    created.push(workspace);
    workspace.db.close();

    const migrationsDir = path.join(workspace.root, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
    for (const [name, sql] of Object.entries(files)) {
      fs.writeFileSync(path.join(migrationsDir, name), sql, 'utf8');
    }

    const db = openDatabase({ databasePath: workspace.paths.database.path });
    return { workspace, db, migrationsDir };
  }

  it('menolak nama file migrasi yang tidak sesuai pola', () => {
    const { workspace, db, migrationsDir } = workspaceWithTempMigrations({
      'awal.sql': 'CREATE TABLE a (id TEXT PRIMARY KEY);',
    });

    try {
      expect(() => loadMigrations(migrationsDir)).toThrow(MigrationError);
      expect(() => runMigrations(db, { migrationsDir })).toThrow(/Nama file migrasi tidak valid/);
    } finally {
      db.close();
      workspace.cleanup();
    }
  });

  it('menolak nomor migrasi yang dipakai ganda', () => {
    const { workspace, db, migrationsDir } = workspaceWithTempMigrations({
      '001_pertama.sql': 'CREATE TABLE a (id TEXT PRIMARY KEY);',
      '001_kedua.sql': 'CREATE TABLE b (id TEXT PRIMARY KEY);',
    });

    try {
      expect(() => runMigrations(db, { migrationsDir })).toThrow(/dipakai ganda/);
    } finally {
      db.close();
      workspace.cleanup();
    }
  });

  it('membatalkan seluruh perubahan bila SQL di tengah migrasi gagal', () => {
    const { workspace, db, migrationsDir } = workspaceWithTempMigrations({
      '001_gagal.sql': `
        CREATE TABLE tabel_a (id TEXT PRIMARY KEY);
        CREATE TABLE tabel_b (id TEXT PRIMARY KEY);
        INI SQL YANG TIDAK VALID;
      `,
    });

    try {
      expect(() => runMigrations(db, { migrationsDir })).toThrow(
        /gagal dan seluruh perubahan dibatalkan/,
      );

      // Tidak ada tabel yang tertinggal dan tidak ada riwayat migrasi.
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name);
      expect(tables).not.toContain('tabel_a');
      expect(listAppliedMigrations(db)).toHaveLength(0);
    } finally {
      db.close();
      workspace.cleanup();
    }
  });

  it('menyimpan riwayat migrasi hanya setelah SQL berhasil', () => {
    const { workspace, db, migrationsDir } = workspaceWithTempMigrations({
      '001_oke.sql': 'CREATE TABLE tabel_oke (id TEXT PRIMARY KEY);',
    });

    try {
      runMigrations(db, { migrationsDir });
      expect(listAppliedMigrations(db).map((row) => row.id)).toEqual(['001_oke']);
    } finally {
      db.close();
      workspace.cleanup();
    }
  });

  it('menolak migrasi yang sudah diterapkan lalu diubah isinya', () => {
    const { workspace, db, migrationsDir } = workspaceWithTempMigrations({
      '001_immutable.sql': 'CREATE TABLE tabel_a (id TEXT PRIMARY KEY);',
    });

    try {
      runMigrations(db, { migrationsDir });

      // Simulasi Someone yang mengubah berkas migrasi yang sudah rilis.
      fs.writeFileSync(
        path.join(migrationsDir, '001_immutable.sql'),
        'CREATE TABLE tabel_a (id TEXT PRIMARY KEY, tambahan TEXT);',
        'utf8',
      );

      expect(() => verifyAppliedMigrations(db, loadMigrations(migrationsDir))).toThrow(
        MigrationChecksumError,
      );
      expect(() => runMigrations(db, { migrationsDir })).toThrow(
        /berbeda dari versi yang sudah diterapkan/,
      );
    } finally {
      db.close();
      workspace.cleanup();
    }
  });

  it('menolak berkas migrasi yang sudah diterapkan tetapi dihapus', () => {
    const { workspace, db, migrationsDir } = workspaceWithTempMigrations({
      '001_ada.sql': 'CREATE TABLE tabel_a (id TEXT PRIMARY KEY);',
      '002_ikut.sql': 'CREATE TABLE tabel_b (id TEXT PRIMARY KEY);',
    });

    try {
      runMigrations(db, { migrationsDir });
      fs.rmSync(path.join(migrationsDir, '002_ikut.sql'));

      expect(() => verifyAppliedMigrations(db)).toThrow(
        /berkas migrasinya tidak ditemukan/,
      );
    } finally {
      db.close();
      workspace.cleanup();
    }
  });

  it('menolak tujuan migrasi yang tidak dikenal', () => {
    const workspace = createTestWorkspace({ migrate: false });
    created.push(workspace);

    expect(() => runMigrations(workspace.db, { upTo: '999_tidak_ada' })).toThrow(
      /tidak ditemukan/,
    );
  });
});

describe('Kumpulan migrasi yang terkunci di repositori', () => {
  it('memuat hanya berkas .sql dengan pola nama yang benar', () => {
    const migrations = loadMigrations(MIGRATIONS_DIR);
    expect(migrations.map((m) => m.id)).toEqual(['001_initial_schema', '002_stored_files']);
    for (const migration of migrations) {
      expect(migration.checksum).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('berisi komentar dokumentasi untuk setiap migrasi', () => {
    for (const migration of loadMigrations(MIGRATIONS_DIR)) {
      expect(migration.sql.startsWith('--')).toBe(true);
      expect(migration.sql).toContain('Rencanaku.ai');
    }
  });
});