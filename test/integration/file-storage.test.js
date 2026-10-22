import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createTestWorkspace, sha256 } from '../helpers/data.js';
import { createFileStorage } from '../../src/modules/storage/file-storage.js';
import { PUBLIC_ROOT, REPO_ROOT } from '../../src/config/paths.js';

describe('FileStorageService', () => {
  /** @type {ReturnType<typeof createTestWorkspace>} */
  let workspace;
  let user;
  let project;

  beforeEach(() => {
    workspace = createTestWorkspace();
    user = workspace.repositories.users.create({
      username: 'pemilik-file',
      displayName: 'Pemilik File',
      passwordHash: 'scrypt$fake$hash',
    });
    project = workspace.repositories.projects.create({
      ownerUserId: user.id,
      name: 'Proyek File',
    });
  });

  afterEach(() => workspace.cleanup());

  /**
   * @param {object} [overrides]
   */
  function storeText(overrides = {}) {
    return workspace.fileStorage.store({
      data: Buffer.from('isi berkas uji', 'utf8'),
      originalName: 'catatan.txt',
      mimeType: 'text/plain',
      ownerUserId: user.id,
      projectId: project.id,
      ...overrides,
    });
  }

  describe('Penyimpanan dasar', () => {
    it('menyimpan metadata lengkap dan byte yang benar', async () => {
      const content = Buffer.from('isi berkas uji', 'utf8');
      const record = await storeText();

      expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(record.originalName).toBe('catatan.txt');
      expect(record.mimeType).toBe('text/plain');
      expect(record.sizeBytes).toBe(content.length);
      expect(record.contentHash).toBe(sha256(content));
      expect(record.hashAlgorithm).toBe('sha256');
      expect(record.state).toBe('active');
      expect(record.deletedAt).toBeNull();
      expect(record.ownerUserId).toBe(user.id);
      expect(record.projectId).toBe(project.id);
      expect(record.scope).toBe('attachment');
      expect(Date.parse(record.createdAt)).not.toBeNaN();
    });

    it('menyimpan file di luar root statis publik', async () => {
      const record = await storeText();
      const absolute = path.resolve(workspace.fileStorage.filesRoot, record.relativePath);

      expect(absolute.startsWith(workspace.paths.directories.files)).toBe(true);
      expect(absolute.startsWith(PUBLIC_ROOT)).toBe(false);
      expect(absolute.startsWith(path.join(REPO_ROOT, 'public'))).toBe(false);
      expect(fs.existsSync(absolute)).toBe(true);
      expect(workspace.paths.dataDir.startsWith(PUBLIC_ROOT)).toBe(false);
    });

    it('nama berkas di disk tidak memakai nama asli pengguna', async () => {
      const record = await storeText({ originalName: '../../etc/passwd' });

      expect(record.relativePath).not.toContain('..');
      expect(record.relativePath).not.toContain('etc');
      expect(record.relativePath).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f-]{36}\.bin$/);
      expect(record.originalName).toBe('../../etc/passwd');
    });

    it('menerima stream dan menghitung hash dengan benar', async () => {
      const chunks = ['bagian-1|', 'bagian-2|', 'bagian-3'];
      const record = await workspace.fileStorage.store({
        data: Readable.from(chunks),
        originalName: 'stream.log',
        mimeType: 'text/plain',
        ownerUserId: user.id,
      });

      const expected = sha256(Buffer.from(chunks.join(''), 'utf8'));
      expect(record.contentHash).toBe(expected);
      expect(await workspace.fileStorage.read(record.id, user.id)).toEqual(
        Buffer.from(chunks.join(''), 'utf8'),
      );
    });

    it('menimpa MIME berbahaya menjadi application/octet-stream', async () => {
      const record = await storeText({ mimeType: 'teks/plain\r\nX-Injected: 1' });
      expect(record.mimeType).toBe('application/octet-stream');
    });

    it('menolak file kosong dan membersihkan temp', async () => {
      await expect(storeText({ data: Buffer.alloc(0) })).rejects.toMatchObject({
        code: 'FILE_EMPTY',
      });
      const tempFiles = fs.readdirSync(workspace.paths.directories.temp);
      expect(tempFiles).toEqual([]);
    });

    it('menolak file melebihi batas ukuran tanpa meninggalkan file', async () => {
      const small = createFileStorage({
        filesDir: workspace.paths.directories.files,
        tempDir: workspace.paths.directories.temp,
        repositories: workspace.repositories,
        maxFileBytes: 16,
      });

      await expect(
        small.store({
          data: Buffer.alloc(64, 1),
          originalName: 'besar.bin',
          ownerUserId: user.id,
        }),
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });

      expect(fs.readdirSync(workspace.paths.directories.temp)).toEqual([]);
      expect(workspace.repositories.storedFiles.listByState('active')).toEqual([]);
    });

    it('menolak penyimpanan tanpa pemilik', async () => {
      await expect(storeText({ ownerUserId: '  ' })).rejects.toMatchObject({
        code: 'FILE_OWNER_REQUIRED',
      });
    });
  });

  describe('Pembacaan dan kepemilikan', () => {
    it('membaca kembali byte yang sama persis', async () => {
      const record = await storeText();
      const bytes = await workspace.fileStorage.read(record.id, user.id);
      expect(bytes.toString('utf8')).toBe('isi berkas uji');
    });

    it('menyediakan read stream untuk unduhan', async () => {
      const record = await storeText();
      const stream = await workspace.fileStorage.createReadStream(record.id, user.id);

      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      expect(Buffer.concat(chunks).toString('utf8')).toBe('isi berkas uji');
    });

    it('menolak pembacaan oleh pemilik lain', async () => {
      const record = await storeText();
      const lain = workspace.repositories.users.create({
        username: 'orang-lain',
        displayName: 'Orang Lain',
        passwordHash: 'scrypt$fake$hash',
      });

      await expect(workspace.fileStorage.read(record.id, lain.id)).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
        status: 404,
      });
    });

    it('menolak ID file yang tidak ada', async () => {
      await expect(workspace.fileStorage.read('tidak-ada', user.id)).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });
  });

  describe('Checksum dan deteksi perubahan', () => {
    it('verify menyatakan checksum cocok dengan konten', async () => {
      const record = await storeText();
      const result = await workspace.fileStorage.verify(record.id);

      expect(result.exists).toBe(true);
      expect(result.hashMatches).toBe(true);
      expect(result.sizeMatches).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('mendeteksi file yang diubah di luar aplikasi', async () => {
      const record = await storeText();
      const absolute = path.resolve(workspace.fileStorage.filesRoot, record.relativePath);
      await fsp.writeFile(absolute, 'isi yang diubah diam-diam');

      const result = await workspace.fileStorage.verify(record.id);
      expect(result.exists).toBe(true);
      expect(result.hashMatches).toBe(false);
      expect(result.reason).toBe('FILE_HASH_MISMATCH');
    });

    it('mendeteksi file yang hilang dari disk', async () => {
      const record = await storeText();
      const absolute = path.resolve(workspace.fileStorage.filesRoot, record.relativePath);
      fs.rmSync(absolute);

      const result = await workspace.fileStorage.verify(record.id);
      expect(result.exists).toBe(false);
      expect(result.reason).toBe('FILE_CONTENT_MISSING');
    });
  });

  describe('Penulisan atomik', () => {
    it('tidak meninggalkan berkas parsial saat penulisan gagal di tengah stream', async () => {
      async function* failingSource() {
        yield Buffer.from('bagian pertama');
        throw new Error('koneksi terputus');
      }

      await expect(
        workspace.fileStorage.store({
          data: Readable.from(failingSource()),
          originalName: 'terputus.txt',
          ownerUserId: user.id,
        }),
      ).rejects.toMatchObject({ code: 'FILE_WRITE_FAILED' });

      expect(fs.readdirSync(workspace.paths.directories.temp)).toEqual([]);
      expect(workspace.repositories.storedFiles.listByState('active')).toEqual([]);

      // Tidak ada berkas yang setengah tertulis di root penyimpanan.
      const walk = (dir) =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory() ? walk(path.join(dir, entry.name)) : [entry.name],
        );
      expect(walk(workspace.paths.directories.files)).toEqual([]);
    });

    it('mengosongkan direktori temp setelah penyimpanan sukses', async () => {
      await storeText();
      expect(fs.readdirSync(workspace.paths.directories.temp)).toEqual([]);
    });
  });

  describe('Kegagalan database tidak menghasilkan record yatim', () => {
    it('menghapus berkas bila pencatatan metadata gagal', async () => {
      // Simulasi kegagalan database tepat setelah byte file tersimpan.
      const failingStorage = createFileStorage({
        filesDir: workspace.paths.directories.files,
        tempDir: workspace.paths.directories.temp,
        repositories: {
          db: workspace.db,
          storedFiles: {
            ...workspace.repositories.storedFiles,
            pathTaken: () => false,
            recordActive: () => {
              throw new Error('simulasi kegagalan database');
            },
          },
        },
      });

      await expect(
        failingStorage.store({
          data: Buffer.from('data penting', 'utf8'),
          originalName: 'gagal.txt',
          ownerUserId: user.id,
        }),
      ).rejects.toMatchObject({ code: 'FILE_REGISTER_FAILED' });

      // Tidak ada record aktif...
      expect(workspace.repositories.storedFiles.listByState('active')).toEqual([]);
      // ...dan tidak ada byte yang tertinggal.
      const walk = (dir) =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory() ? walk(path.join(dir, entry.name)) : [entry.name],
        );
      expect(walk(workspace.paths.directories.files)).toEqual([]);
    });
  });

  describe('Penghapusan', () => {
    it('menandai record terlebih dahulu lalu menghapus byte', async () => {
      const record = await storeText();
      const absolute = path.resolve(workspace.fileStorage.filesRoot, record.relativePath);

      const result = await workspace.fileStorage.remove(record.id, user.id);
      expect(result).toEqual({ marked: true, fileRemoved: true });

      const stored = workspace.repositories.storedFiles.findByIdForSystem(record.id);
      expect(stored.state).toBe('deleted');
      expect(stored.deletedAt).not.toBeNull();
      expect(fs.existsSync(absolute)).toBe(false);
    });

    it('record terhapus tidak dapat dibaca lagi', async () => {
      const record = await storeText();
      await workspace.fileStorage.remove(record.id, user.id);

      await expect(workspace.fileStorage.read(record.id, user.id)).rejects.toMatchObject({
        code: 'FILE_UNAVAILABLE',
        status: 410,
      });
    });

    it('penghapusan oleh pemilik lain ditolak', async () => {
      const record = await storeText();
      const lain = workspace.repositories.users.create({
        username: 'penghapus',
        displayName: 'Penghapus',
        passwordHash: 'scrypt$fake$hash',
      });

      await expect(workspace.fileStorage.remove(record.id, lain.id)).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
      expect(workspace.repositories.storedFiles.findByIdForSystem(record.id).state).toBe('active');
    });
  });

  describe('Resolver path', () => {
    it('menolak path traversal pada resolusi internal', () => {
      expect(() => workspace.fileStorage.resolve('../rahasia.txt')).toThrow(
        /keluar dari root penyimpanan/,
      );
      expect(() => workspace.fileStorage.resolve('/etc/passwd')).toThrow(
        /harus relatif terhadap root penyimpanan/,
      );
    });

    it('menghasilkan path di dalam root untuk path aman', () => {
      const resolved = workspace.fileStorage.resolve('ab/cd/berkas.txt');
      expect(resolved.startsWith(workspace.fileStorage.filesRoot)).toBe(true);
    });
  });

  describe('Kuota per pemilik', () => {
    it('menghitung total ukuran file aktif milik pemilik', async () => {
      await storeText({ data: Buffer.from('12345', 'utf8') });
      await storeText({ data: Buffer.from('6789', 'utf8') });

      expect(workspace.repositories.storedFiles.usageByOwner(user.id)).toEqual({
        totalBytes: 9,
        totalFiles: 2,
      });
    });

    it('tidak menghitung file yang sudah dihapus', async () => {
      const record = await storeText({ data: Buffer.from('12345', 'utf8') });
      await workspace.fileStorage.remove(record.id, user.id);

      expect(workspace.repositories.storedFiles.usageByOwner(user.id)).toEqual({
        totalBytes: 0,
        totalFiles: 0,
      });
    });
  });
});