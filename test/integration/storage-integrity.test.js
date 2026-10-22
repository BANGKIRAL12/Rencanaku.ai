import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestWorkspace } from '../helpers/data.js';
import { openDatabase } from '../../src/db/connection.js';
import { getMigrationStatus } from '../../src/db/migrate.js';
import {
  checkDataDirectory,
  checkDatabaseIntegrity,
  checkStorageIntegrity,
  runIntegrityChecks,
} from '../../src/modules/storage/storage-integrity.js';
import { createFileStorage } from '../../src/modules/storage/file-storage.js';

describe('Pemeriksaan integritas', () => {
  /** @type {ReturnType<typeof createTestWorkspace>} */
  let workspace;
  let user;
  let project;

  beforeEach(() => {
    workspace = createTestWorkspace();
    user = workspace.repositories.users.create({
      username: 'pemilik-integrity',
      displayName: 'Pemilik Integrity',
      passwordHash: 'scrypt$fake$hash',
    });
    project = workspace.repositories.projects.create({
      ownerUserId: user.id,
      name: 'Proyek Integrity',
    });
  });

  afterEach(() => workspace.cleanup());

  /**
   * @param {string} [content]
   */
  function storeFile(content = 'isi berkas integritas') {
    return workspace.fileStorage.store({
      data: Buffer.from(content, 'utf8'),
      originalName: 'berkas.txt',
      mimeType: 'text/plain',
      ownerUserId: user.id,
      projectId: project.id,
    });
  }

  /**
   * @param {string} root
   * @param {string} relativePath
   */
  function absoluteOf(root, relativePath) {
    return path.join(root, relativePath);
  }

  describe('Database', () => {
    it('lulus seluruh pemeriksaan pada database yang baru dimigrasi', async () => {
      const report = await checkDatabaseIntegrity({
        db: workspace.db,
        expectedSchemaVersion: getMigrationStatus(workspace.db).latestVersion,
      });

      expect(report.ok).toBe(true);
      expect(report.checks.every((c) => c.status === 'pass')).toBe(true);

      const ids = report.checks.map((c) => c.id);
      expect(ids).toContain('db.integrity_check');
      expect(ids).toContain('db.foreign_keys');
      expect(ids).toContain('db.foreign_key_check');
      expect(ids).toContain('db.migrations_applied');
      expect(ids).toContain('db.schema_up_to_date');
      expect(ids).toContain('db.journal_mode');

      const integrity = report.checks.find((c) => c.id === 'db.integrity_check');
      expect(integrity.details.result).toBe('ok');
    });

    it('menandai database yang belum dimigrasi sebagai gagal', async () => {
      const kosong = createTestWorkspace({ migrate: false });

      try {
        const report = await checkDatabaseIntegrity({ db: kosong.db });
        expect(report.ok).toBe(false);

        const status = report.checks.find((c) => c.id === 'db.schema_up_to_date');
        expect(status.status).toBe('fail');
        expect(status.message).toContain('belum diterapkan');
      } finally {
        kosong.cleanup();
      }
    });

    it('menandai versi skema yang berbeda sebagai peringatan, bukan kegagalan', async () => {
      const report = await checkDatabaseIntegrity({
        db: workspace.db,
        expectedSchemaVersion: '999_versi_masa_depan',
      });

      expect(report.ok).toBe(true);
      const check = report.checks.find((c) => c.id === 'db.schema_version_matches_app');
      expect(check.status).toBe('warn');
    });

    it('melaporkan koneksi yang sudah ditutup tanpa melempar', async () => {
      const terpisah = openDatabase({
        databasePath: path.join(workspace.paths.directories.files, 'lain.sqlite'),
      });
      terpisah.close();

      const report = await checkDatabaseIntegrity({ db: terpisah });
      expect(report.ok).toBe(false);
      expect(report.checks[0].message).toMatch(/tertutup/);
    });
  });

  describe('Penyimpanan file', () => {
    it('lulus saat byte, ukuran, dan checksum cocok', async () => {
      await storeFile('berkas pertama');
      await storeFile('berkas kedua');

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
      });

      expect(report.ok).toBe(true);
      expect(report.missingFiles).toEqual([]);
      expect(report.hashMismatches).toEqual([]);
      expect(report.orphanFiles).toEqual([]);

      const checksum = report.checks.find((c) => c.id === 'storage.checksum_matches');
      expect(checksum.details).toEqual({ hashed: 2, mismatches: 0 });
    });

    it('mendeteksi record aktif yang kehilangan byte', async () => {
      const record = await storeFile();
      fs.rmSync(absoluteOf(workspace.paths.directories.files, record.relativePath));

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
      });

      expect(report.ok).toBe(false);
      expect(report.missingFiles).toEqual([record.id]);
      expect(report.checks.find((c) => c.id === 'storage.active_files_present').status).toBe(
        'fail',
      );
    });

    it('mendeteksi file yang berubah di luar aplikasi', async () => {
      const record = await storeFile('isi asli');
      fs.writeFileSync(
        absoluteOf(workspace.paths.directories.files, record.relativePath),
        'isi yang diubah',
      );

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
      });

      expect(report.ok).toBe(false);
      expect(report.hashMismatches).toEqual([record.id]);
      expect(report.checks.find((c) => c.id === 'storage.checksum_matches').status).toBe('fail');
    });

    it('melaporkan file yatim sebagai peringatan, bukan kegagalan', async () => {
      const orphan = path.join(workspace.paths.directories.files, 'ff', 'ee', 'yatim.bin');
      fs.mkdirSync(path.dirname(orphan), { recursive: true });
      fs.writeFileSync(orphan, 'tanpa metadata');

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
      });

      expect(report.ok).toBe(true);
      expect(report.orphanFiles).toEqual(['ff/ee/yatim.bin']);
      expect(report.checks.find((c) => c.id === 'storage.no_orphan_files').status).toBe('warn');
    });

    it('tidak menganggap file terhapus sebagai yatim', async () => {
      const record = await storeFile();
      await workspace.fileStorage.remove(record.id, user.id);

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
      });

      expect(report.orphanFiles).toEqual([]);
      expect(report.ok).toBe(true);
    });

    it('melaporkan record pending yang menggantung', async () => {
      workspace.repositories.storedFiles.recordPending({
        id: 'file-pending',
        ownerUserId: user.id,
        originalName: 'belum-selesai.bin',
        relativePath: 'aa/bb/file-pending.bin',
        contentHash: 'a'.repeat(64),
      });

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
      });

      expect(report.ok).toBe(true);
      expect(report.checks.find((c) => c.id === 'storage.no_pending_records').status).toBe('warn');
    });

    it('gagal bila root penyimpanan tidak ada', async () => {
      fs.rmSync(workspace.paths.directories.files, { recursive: true, force: true });

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
      });

      expect(report.ok).toBe(false);
      expect(report.checks[0].id).toBe('storage.root_exists');
    });

    it('membatasi jumlah file yang di-hash bila diminta', async () => {
      await storeFile('satu');
      await storeFile('dua');
      await storeFile('tiga');

      const report = await checkStorageIntegrity({
        filesDir: workspace.paths.directories.files,
        repositories: workspace.repositories,
        hashLimit: 1,
      });

      expect(report.checks.find((c) => c.id === 'storage.checksum_matches').details.hashed).toBe(1);
    });
  });

  describe('Direktori data', () => {
    it('lulus dengan izin 700 pada setiap direktori', async () => {
      const report = await checkDataDirectory(workspace.paths);

      expect(report.ok).toBe(true);
      expect(report.checks.map((c) => c.id)).toContain('data.dir.files');
      expect(report.checks.map((c) => c.id)).toContain('data.dir.config');

      for (const check of report.checks) {
        expect(check.message).not.toContain(workspace.root);
      }
    });

    it('menandai direktori dengan izin terlalu longgar', async () => {
      if (process.platform === 'win32') return;

      const filesDir = workspace.paths.directories.files;
      fs.chmodSync(filesDir, 0o755);
      try {
        const report = await checkDataDirectory(workspace.paths);
        expect(report.ok).toBe(false);

        const check = report.checks.find((c) => c.id === 'data.dir.files');
        expect(check.status).toBe('fail');
        expect(check.message).toContain('755');
      } finally {
        fs.chmodSync(filesDir, 0o700);
      }
    });

    it('menandai direktori yang dihapus', async () => {
      fs.rmSync(workspace.paths.directories.backups, { recursive: true, force: true });

      const report = await checkDataDirectory(workspace.paths);
      expect(report.ok).toBe(false);
      expect(report.checks.find((c) => c.id === 'data.dir.backups').status).toBe('fail');
    });
  });

  describe('Laporan gabungan', () => {
    it('menggabungkan pemeriksaan database, storage, dan direktori', async () => {
      await storeFile();

      const report = await runIntegrityChecks({
        db: workspace.db,
        filesDir: workspace.paths.directories.files,
        paths: workspace.paths,
        repositories: workspace.repositories,
        expectedSchemaVersion: getMigrationStatus(workspace.db).latestVersion,
      });

      expect(report.ok).toBe(true);
      expect(report.storage).toBeDefined();
      expect(report.checks.length).toBeGreaterThan(10);
      expect(report.summary.join(' ')).toMatch(/\d+ pemeriksaan dijalankan/);
      expect(report.summary.join(' ')).toContain('0 gagal');
    });

    it('gagal gabungan bila salah satu pemeriksaan gagal', async () => {
      const record = await storeFile();
      fs.rmSync(absoluteOf(workspace.paths.directories.files, record.relativePath));

      const report = await runIntegrityChecks({
        db: workspace.db,
        filesDir: workspace.paths.directories.files,
        paths: workspace.paths,
        repositories: workspace.repositories,
      });

      expect(report.ok).toBe(false);
      expect(report.summary.join(' ')).toContain('1 gagal');
    });
  });

  describe('File storage dan integritas', () => {
    it('file yang disimpan selalu lolos pemeriksaan checksum', async () => {
      const storage = createFileStorage({
        filesDir: workspace.paths.directories.files,
        tempDir: workspace.paths.directories.temp,
        repositories: workspace.repositories,
      });

      const record = await storage.store({
        data: Buffer.from('verifikasi silang', 'utf8'),
        originalName: 'silang.txt',
        ownerUserId: user.id,
      });

      const hasil = await storage.verify(record.id);
      expect(hasil.hashMatches).toBe(true);
      expect(hasil.sizeMatches).toBe(true);
    });
  });
});
