import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestWorkspace, fixedClock, sequentialIds, sha256 } from '../helpers/data.js';

/**
 * Tes kontrak repository.
 *
 * Fokus pada perilaku yang menjadi batas keamanan: repository menerima
 * `ownerUserId` dari lapisan server (bukan dari browser), tidak pernah
 * mengembalikan rahasia ke lapisan tampilan, dan menolak menyimpan rahasia
 * di tabel pengaturan/audit.
 */
describe('Repository', () => {
  /** @type {ReturnType<typeof createTestWorkspace>} */
  let workspace;
  let users;
  let sessions;
  let projects;
  let conversations;
  let messages;
  let settings;
  let audit;
  let storedFiles;

  beforeEach(() => {
    workspace = createTestWorkspace();
    ({ users, sessions, projects, conversations, messages, settings, audit, storedFiles } =
      workspace.repositories);
  });

  afterEach(() => workspace.cleanup());

  /**
   * @param {string} username
   * @param {object} [overrides]
   */
  function createUser(username, overrides = {}) {
    return users.create({
      username,
      displayName: `Nama ${username}`,
      passwordHash: 'scrypt$N=16384,r=8,p=1$salt$hash',
      ...overrides,
    });
  }

  describe('users', () => {
    it('membuat pengguna tanpa mengembalikan hash password', () => {
      const user = createUser('sari');

      expect(user.username).toBe('sari');
      expect(user.displayName).toBe('Nama sari');
      expect(user.role).toBe('member');
      expect(user.status).toBe('active');
      expect(user.locale).toBe('id');
      expect(user.theme).toBe('system');
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password_hash');
    });

    it('menyimpan hash hanya untuk kebutuhan autentikasi', () => {
      const user = createUser('budi');

      expect(users.findById(user.id)).not.toHaveProperty('passwordHash');
      expect(users.findAuthRecordById(user.id).passwordHash).toBe(
        'scrypt$N=16384,r=8,p=1$salt$hash',
      );
      expect(users.findAuthRecordByUsername('BUDI').passwordHash).toContain('scrypt$');
    });

    it('mencari username tanpa membedakan kapitalisasi dan spasi', () => {
      const user = createUser('  Citra  ');

      expect(users.findByUsername('citra').id).toBe(user.id);
      expect(users.findByUsername('CITRA').id).toBe(user.id);
      expect(users.findByUsername('tidak-ada')).toBeNull();
    });

    it('memperbarui profil dan menandai waktu perubahan', () => {
      const user = createUser('dewi');
      const updated = users.updateProfile(user.id, {
        displayName: 'Dewi Lestari',
        theme: 'dark',
        locale: 'en',
      });

      expect(updated.displayName).toBe('Dewi Lestari');
      expect(updated.theme).toBe('dark');
      expect(updated.locale).toBe('en');
      expect(updated.updatedAt >= user.updatedAt).toBe(true);
    });

    it('mengubah status dan role hanya ke nilai yang diizinkan', () => {
      const user = createUser('eka');

      expect(users.updateStatus(user.id, { status: 'disabled' }).status).toBe('disabled');
      expect(users.updateRole(user.id, 'admin').role).toBe('admin');
      expect(() => users.updateRole(user.id, 'pemilik')).toThrow(/tidak valid/);
    });

    it('mencatat waktu login terakhir', () => {
      const user = createUser('fajar');
      expect(users.recordLogin(user.id)).toBe(true);
      expect(users.recordLogin('user-tidak-ada')).toBe(false);

      const loggedIn = users.findById(user.id);
      expect(loggedIn.lastLoginAt).not.toBeNull();
      expect(Date.parse(loggedIn.lastLoginAt)).not.toBeNaN();
    });

    it('menolak input wajib yang kosong atau terlalu panjang', () => {
      expect(() => createUser('   ')).toThrow(/wajib diisi/);
      expect(() =>
        users.create({
          username: 'x'.repeat(65),
          displayName: 'Panjang',
          passwordHash: 'hash',
        }),
      ).toThrow(/terlalu panjang/);
      expect(() =>
        users.create({ username: 'tanpa-hash', displayName: 'Tanpa Hash', passwordHash: '  ' }),
      ).toThrow(/wajib diisi/);
    });

    it('menghitung dan mendaftar pengguna dengan paginasi', () => {
      createUser('gita');
      createUser('hadi');

      expect(users.count()).toBe(2);
      expect(users.list({ limit: 1 })).toHaveLength(1);
      expect(users.list({ limit: 10, offset: 1 })).toHaveLength(1);
      expect(users.list()).toHaveLength(2);
    });

    it('menghapus pengguna yang tidak memiliki data terkait', () => {
      const user = createUser('indah');
      expect(users.remove(user.id)).toBe(true);
      expect(users.findById(user.id)).toBeNull();
    });
  });

  describe('sessions', () => {
    /**
     * @param {object} [overrides]
     */
    function createSession(overrides = {}) {
      const now = Math.floor(Date.now() / 1000);
      return sessions.create({
        token: 'token-mentah-rahasia',
        userId: null,
        expiresAt: new Date((now + 3600) * 1000).toISOString(),
        expiresAtUnix: now + 3600,
        userAgent: 'vitest',
        ...overrides,
      });
    }

    it('tidak pernah menyimpan token mentah', () => {
      const session = createSession();
      expect(session).not.toHaveProperty('token');

      const row = workspace.db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(session.id);
      expect(row.token_hash).toBe(sha256('token-mentah-rahasia'));
      expect(JSON.stringify(row)).not.toContain('token-mentah-rahasia');
    });

    it('menemukan sesi aktif berdasarkan token mentah', () => {
      createSession();
      const found = sessions.findActiveByToken('token-mentah-rahasia');

      expect(found).not.toBeNull();
      expect(found.data).toEqual({});
    });

    it('menolak token yang tidak dikenal', () => {
      createSession();
      expect(sessions.findActiveByToken('token-lain')).toBeNull();
    });

    it('menganggap sesi kedaluwarsa sebagai tidak aktif', () => {
      const now = Math.floor(Date.now() / 1000);
      sessions.create({
        token: 'token-kedaluwarsa',
        expiresAt: new Date((now - 10) * 1000).toISOString(),
        expiresAtUnix: now - 10,
      });

      const result = sessions.findActiveByToken('token-kedaluwarsa', { nowUnix: now });
      expect(result).toBeNull();
      expect(sessions.countActive({ nowUnix: now })).toBe(0);
    });

    it('menempelkan user setelah login berhasil', () => {
      const user = createUser('joko');
      const session = createSession();
      const attached = sessions.attachUser(session.id, user.id, { csrf: 'nilai-csrf' });

      expect(attached.userId).toBe(user.id);
      expect(attached.data).toEqual({ csrf: 'nilai-csrf' });
    });

    it('mencabut sesi berdasarkan token dan semua sesi milik user', () => {
      const user = createUser('kiki');
      const now = Math.floor(Date.now() / 1000);

      sessions.create({
        token: 'token-a',
        userId: user.id,
        expiresAt: new Date((now + 3600) * 1000).toISOString(),
        expiresAtUnix: now + 3600,
      });
      sessions.create({
        token: 'token-b',
        userId: user.id,
        expiresAt: new Date((now + 3600) * 1000).toISOString(),
        expiresAtUnix: now + 3600,
      });

      expect(sessions.revokeByToken('token-a')).toBe(true);
      expect(sessions.findActiveByToken('token-a')).toBeNull();
      expect(sessions.findActiveByToken('token-b')).not.toBeNull();

      expect(sessions.revokeAllForUser(user.id)).toBe(1);
      expect(sessions.findActiveByToken('token-b')).toBeNull();
    });

    it('membersihkan sesi kedaluwarsa', () => {
      const now = Math.floor(Date.now() / 1000);
      sessions.create({
        token: 'token-lama',
        expiresAt: new Date((now - 60) * 1000).toISOString(),
        expiresAtUnix: now - 60,
      });

      expect(sessions.prune({ nowUnix: now })).toBe(1);
      expect(sessions.countActive({ nowUnix: now })).toBe(0);
    });
  });

  describe('projects', () => {
    it('membuat slug unik berurutan untuk nama yang sama', () => {
      const user = createUser('lina');
      const first = projects.create({ ownerUserId: user.id, name: 'Aplikasi Kasir' });
      const second = projects.create({ ownerUserId: user.id, name: 'Aplikasi Kasir' });

      expect(first.slug).toBe('aplikasi-kasir');
      expect(second.slug).toBe('aplikasi-kasir-2');
      expect(first.status).toBe('active');
      expect(first.archivedAt).toBeNull();
    });

    it('membatasi slug ke pola yang aman untuk URL', () => {
      const user = createUser('mira');
      const project = projects.create({
        ownerUserId: user.id,
        name: '  Proyek / Eksperimen #1 ?? ',
      });

      expect(project.slug).toMatch(/^[a-z0-9-]+$/);
      expect(project.slug.startsWith('proyek-eksperimen')).toBe(true);
    });

    it('hanya mengembalikan proyek milik pemilik yang diminta', () => {
      const owner = createUser('nanda');
      const lain = createUser('oscar');
      const project = projects.create({ ownerUserId: owner.id, name: 'Milik Nanda' });

      expect(projects.findOwned(project.id, lain.id)).toBeNull();
      expect(projects.findOwned(project.id, owner.id).id).toBe(project.id);
      expect(projects.listByOwner(lain.id)).toEqual([]);
      expect(projects.countActiveByOwner(lain.id)).toBe(0);
    });

    it('mengubah nama tanpa mengubah kepemilikan', () => {
      const user = createUser('putri');
      const project = projects.create({ ownerUserId: user.id, name: 'Nama Lama' });
      const renamed = projects.rename(project.id, user.id, { name: 'Nama Baru' });

      expect(renamed.name).toBe('Nama Baru');
      expect(renamed.slug).toBe('nama-baru');
      expect(renamed.ownerUserId).toBe(user.id);
      // Pemilik lain tidak boleh mengubah nama: hasilnya null dan data utuh.
      expect(projects.rename(project.id, 'user-lain', { name: 'Curang' })).toBeNull();
      expect(projects.findOwned(project.id, user.id).name).toBe('Nama Baru');
    });

    it('mengelola status arsip dan sampah secara konsisten', () => {
      const user = createUser('qori');
      const project = projects.create({ ownerUserId: user.id, name: 'Proyek Arsip' });

      const archived = projects.setStatus(project.id, user.id, 'archived');
      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).not.toBeNull();

      const restored = projects.setStatus(project.id, user.id, 'active');
      expect(restored.status).toBe('active');
      expect(restored.archivedAt).toBeNull();
    });

    it('mencari proyek berdasarkan nama milik sendiri', () => {
      const user = createUser('rina');
      projects.create({ ownerUserId: user.id, name: 'Website Sekolah' });
      projects.create({ ownerUserId: user.id, name: 'Aplikasi Kasir' });

      const found = projects.searchByOwner(user.id, 'sekolah');
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Website Sekolah');
    });
  });

  describe('conversations & messages', () => {
    let user;
    let project;

    beforeEach(() => {
      user = createUser('sinta');
      project = projects.create({ ownerUserId: user.id, name: 'Proyek Percakapan' });
    });

    it('membuat tepat satu percakapan default per proyek', () => {
      const first = conversations.ensureDefault(project.id, user.id);
      const second = conversations.ensureDefault(project.id, user.id);

      expect(first.id).toBe(second.id);
      expect(first.isDefault).toBe(true);
      expect(conversations.countByProject(project.id, user.id)).toBe(1);
    });

    it('memberi urutan pesan berurutan otomatis', () => {
      const conversation = conversations.ensureDefault(project.id, user.id);

      const first = messages.createWithSequence({
        conversationId: conversation.id,
        projectId: project.id,
        ownerUserId: user.id,
        role: 'user',
        content: 'Halo',
      });
      const second = messages.createWithSequence({
        conversationId: conversation.id,
        projectId: project.id,
        ownerUserId: user.id,
        role: 'assistant',
        content: 'Halo juga',
      });

      expect(first.sequence).toBe(1);
      expect(second.sequence).toBe(2);
      expect(messages.countByConversation(conversation.id, user.id)).toBe(2);
      expect(
        messages.listByConversation(conversation.id, user.id).map((m) => m.sequence),
      ).toEqual([1, 2]);
    });

    it('menolak percakapan untuk proyek milik akun lain', () => {
      const orangLain = createUser('tono');

      // Trigger database menolak percakapan lintas akun; tidak ada baris
      // yang tercipta dan daftar milik akun lain tetap kosong.
      expect(() => conversations.ensureDefault(project.id, orangLain.id)).toThrow();
      expect(conversations.countByProject(project.id, orangLain.id)).toBe(0);
      expect(conversations.listByProject(project.id, orangLain.id)).toEqual([]);
    });

    it('menonaktifkan pesan tanpa menghapus riwayat', () => {
      const conversation = conversations.ensureDefault(project.id, user.id);
      const message = messages.createWithSequence({
        conversationId: conversation.id,
        projectId: project.id,
        ownerUserId: user.id,
        role: 'assistant',
        content: 'Draf awal',
      });

      const updated = messages.updateStatus(message.id, user.id, { status: 'cancelled' });
      expect(updated.status).toBe('cancelled');
      expect(messages.findOwned(message.id, user.id)).not.toBeNull();
    });

    it('membatasi pembacaan pesan berdasarkan pemilik', () => {
      const conversation = conversations.ensureDefault(project.id, user.id);
      const message = messages.createWithSequence({
        conversationId: conversation.id,
        projectId: project.id,
        ownerUserId: user.id,
        role: 'user',
        content: 'Rahasia',
      });
      const orangLain = createUser('umi');

      expect(messages.findOwned(message.id, orangLain.id)).toBeNull();
      expect(messages.listByConversation(conversation.id, orangLain.id)).toEqual([]);
    });

    it('menghapus percakapan beserta pesannya hanya untuk pemilik', () => {
      const conversation = conversations.ensureDefault(project.id, user.id);
      messages.createWithSequence({
        conversationId: conversation.id,
        projectId: project.id,
        ownerUserId: user.id,
        role: 'user',
        content: 'Akan dihapus',
      });

      const orangLain = createUser('vera');
      expect(conversations.remove(conversation.id, orangLain.id)).toBe(false);
      expect(conversations.remove(conversation.id, user.id)).toBe(true);
      expect(messages.countByConversation(conversation.id, user.id)).toBe(0);
    });
  });

  describe('app_settings', () => {
    it('menyimpan dan membaca nilai bertipe', () => {
      settings.setInstance({ key: 'app.name', value: 'Rencanaku.ai' });
      settings.setInstance({ key: 'app.max_projects', value: 12 });
      settings.setInstance({ key: 'ui.compact', value: true });
      settings.setInstance({ key: 'ai.default', value: { provider: 'lokal' } });

      expect(settings.getInstance('app.name').value).toBe('Rencanaku.ai');
      expect(settings.getInstance('app.max_projects').value).toBe(12);
      expect(settings.getInstance('ui.compact').value).toBe(true);
      expect(settings.getInstance('ai.default').value).toEqual({ provider: 'lokal' });
      expect(settings.getInstance('tidak-ada')).toBeNull();
    });

    it('memisahkan pengaturan instance dan pengaturan pengguna', () => {
      const user = createUser('wawan');
      settings.setInstance({ key: 'ui.theme_default', value: 'dark' });
      settings.setForUser({ ownerUserId: user.id, key: 'ui.theme_default', value: 'light' });

      expect(settings.getInstance('ui.theme_default').value).toBe('dark');
      expect(settings.getForUser(user.id, 'ui.theme_default').value).toBe('light');
      expect(settings.getForUser('user-lain', 'ui.theme_default')).toBeNull();
    });

    it('menolak menyimpan rahasia di app_settings', () => {
      expect(() =>
        settings.setInstance({ key: 'ai.api_key', value: 'sk-rahasia', isSecret: true }),
      ).toThrow(/tidak boleh menyimpan rahasia/);
      expect(() =>
        settings.setInstance({ key: 'ai.api_key', value: 'sk-rahasia', isSecret: true }),
      ).toThrow(
        expect.objectContaining({ code: 'SETTINGS_SECRET_FORBIDDEN' }),
      );

      const user = createUser('xena');
      expect(() =>
        settings.setForUser({
          ownerUserId: user.id,
          key: 'ai.api_key',
          value: 'sk-rahasia',
          isSecret: true,
        }),
      ).toThrow(/tidak boleh menyimpan rahasia/);

      expect(settings.listInstance()).toEqual([]);
    });

    it('menghapus pengaturan', () => {
      settings.setInstance({ key: 'a', value: 1 });
      settings.setInstance({ key: 'b', value: 2 });

      expect(settings.removeInstance('a')).toBe(true);
      expect(settings.removeInstance('a')).toBe(false);
      expect(settings.listInstance().map((row) => row.key)).toEqual(['b']);
    });
  });

  describe('audit_events', () => {
    it('mencatat peristiwa dengan metadata dan filter', () => {
      const user = createUser('yusuf');
      const project = projects.create({ ownerUserId: user.id, name: 'Proyek Audit' });

      audit.record({
        action: 'project.view',
        actorUserId: user.id,
        actorRole: 'member',
        projectId: project.id,
        targetType: 'project',
        targetId: project.id,
        requestId: 'req-1',
        metadata: { jumlahProyek: 3 },
      });
      audit.record({ action: 'auth.login', actorUserId: user.id, outcome: 'failure' });

      expect(audit.count()).toBe(2);
      expect(audit.listByActor(user.id)).toHaveLength(2);
      expect(audit.listByAction('project.view')[0].metadata).toEqual({ jumlahProyek: 3 });
      expect(audit.listByProject(project.id)).toHaveLength(1);
      expect(audit.listByProject(project.id)[0].requestId).toBe('req-1');
    });

    it('menolak metadata yang menyerupai rahasia', () => {
      const cases = [
        { apiKey: 'sk-abc' },
        { password: 'rahasia' },
        { Authorization: 'Bearer x' },
        { api_key: 'x' },
        { clientSecret: 'x' },
      ];

      for (const metadata of cases) {
        expect(() => audit.record({ action: 'uji', metadata })).toThrow(
          expect.objectContaining({ code: 'AUDIT_METADATA_FORBIDDEN' }),
        );
      }

      expect(audit.count()).toBe(0);
    });

    it('menolak action kosong', () => {
      expect(() => audit.record({ action: '   ' })).toThrow(/wajib diisi/);
    });
  });

  describe('stored_files', () => {
    it('mencatat file aktif dan menghitung pemakaian per pemilik', () => {
      const user = createUser('zaki');
      const project = projects.create({ ownerUserId: user.id, name: 'Proyek File' });

      storedFiles.recordActive({
        id: 'file-1',
        ownerUserId: user.id,
        projectId: project.id,
        originalName: 'dokumen.pdf',
        relativePath: 'ab/cd/file-1.pdf',
        sizeBytes: 10,
        contentHash: 'a'.repeat(64),
      });

      expect(storedFiles.usageByOwner(user.id)).toEqual({ totalBytes: 10, totalFiles: 1 });
      expect(storedFiles.listActiveByProject(project.id, user.id)).toHaveLength(1);
      expect(storedFiles.findOwned('file-1', 'user-lain')).toBeNull();
      expect(storedFiles.pathTaken('ab/cd/file-1.pdf')).toBe(true);
    });

    it('menandai file terhapus dan tidak menghitungnya lagi', () => {
      const user = createUser('agus');
      storedFiles.recordActive({
        id: 'file-2',
        ownerUserId: user.id,
        originalName: 'laporan.txt',
        relativePath: 'ef/01/file-2.txt',
        sizeBytes: 5,
        contentHash: 'b'.repeat(64),
      });

      expect(storedFiles.markDeleted('file-2', user.id)).toBe(true);
      expect(storedFiles.usageByOwner(user.id)).toEqual({ totalBytes: 0, totalFiles: 0 });
      expect(storedFiles.findByIdForSystem('file-2').state).toBe('deleted');
      expect(storedFiles.listByState('active')).toEqual([]);
    });

    it('tidak dapat menandai file milik akun lain sebagai terhapus', () => {
      const user = createUser('bella');
      storedFiles.recordActive({
        id: 'file-3',
        ownerUserId: user.id,
        originalName: 'privat.txt',
        relativePath: '12/34/file-3.txt',
        sizeBytes: 5,
        contentHash: 'c'.repeat(64),
      });

      expect(storedFiles.markDeleted('file-3', 'user-lain')).toBe(false);
      expect(storedFiles.findByIdForSystem('file-3').state).toBe('active');
    });
  });

  describe('Alat bantu uji', () => {
    it('clock dan ID deterministik menghasilkan nilai yang dapat diprediksi', () => {
      const clock = fixedClock('2026-01-02T03:04:05.000Z');
      const ids = sequentialIds('abcdefghijklmnopqrstuvwx');

      expect(clock.now()).toBe('2026-01-02T03:04:05.000Z');
      expect(clock.now()).toBe('2026-01-02T03:04:06.000Z');
      expect(ids()).toBe('abcdefghijklmnopqrstuvwx000000000001');
      expect(ids()).toBe('abcdefghijklmnopqrstuvwx000000000002');
      expect(sha256(Buffer.from('abc'))).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });
});
