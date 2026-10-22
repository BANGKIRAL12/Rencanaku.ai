import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestWorkspace, seedProjectFixture } from '../helpers/data.js';

/**
 * Tes invarian database.
 *
 * Tujuan: membuktikan bahwa batas privasi dan integritas tidak hanya
 * bergantung pada kode aplikasi. Bila suatu saat ada use case yang lupa
 * memeriksa ownership, database tetap menolak data lintas akun.
 */
describe('Invarian database', () => {
  let workspace;
  let alice;
  let bob;
  let aliceProject;
  let bobProject;

  beforeAll(() => {
    workspace = createTestWorkspace();

    alice = workspace.repositories.users.create({
      username: 'alice',
      displayName: 'Alice',
      passwordHash: 'scrypt$fake$hash',
    });
    bob = workspace.repositories.users.create({
      username: 'bob',
      displayName: 'Bob',
      passwordHash: 'scrypt$fake$hash',
    });

    aliceProject = workspace.repositories.projects.create({
      ownerUserId: alice.id,
      name: 'Proyek Alice',
    });
    bobProject = workspace.repositories.projects.create({
      ownerUserId: bob.id,
      name: 'Proyek Bob',
    });
  });

  afterAll(() => workspace.cleanup());

  describe('Foreign keys', () => {
    it('aktif pada setiap koneksi yang dibuka modul connection', () => {
      expect(workspace.db.pragma('foreign_keys', { simple: true })).toBe(1);
    });

    it('menolak proyek dengan owner yang tidak ada', () => {
      expect(() =>
        workspace.db
          .prepare('INSERT INTO projects (id, owner_user_id, name, slug) VALUES (?, ?, ?, ?)')
          .run('proyek-yatim', 'user-tidak-ada', 'Yatim', 'yatim'),
      ).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('menolak sesi dengan user yang tidak ada', () => {
      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO sessions (id, token_hash, user_id, expires_at, expires_at_unix)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run('sesi-yatim', 'a'.repeat(64), 'user-tidak-ada', '2027-01-01T00:00:00.000Z', 1798761600),
      ).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('menolak audit event dengan project yang tidak ada', () => {
      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO audit_events (id, action, project_id)
             VALUES (?, 'project.view', ?)`,
          )
          .run('audit-yatim', 'proyek-tidak-ada'),
      ).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('PRAGMA foreign_key_check tidak menemukan pelanggaran pada data normal', () => {
      expect(workspace.db.pragma('foreign_key_check')).toEqual([]);
    });

    it('menolak menghapus user yang masih memiliki proyek (RESTRICT)', () => {
      expect(() => workspace.repositories.users.remove(alice.id)).toThrow(
        /masih terkait dengan data lain/,
      );
      expect(workspace.repositories.users.findById(alice.id)).not.toBeNull();
    });
  });

  describe('Batas kepemilikan (trigger database)', () => {
    it('menolak percakapan dengan project yang tidak ada (trigger ownership)', () => {
      expect(() =>
        workspace.db
          .prepare(
            'INSERT INTO conversations (id, project_id, owner_user_id) VALUES (?, ?, ?)',
          )
          .run('percakapan-yatim', 'proyek-tidak-ada', alice.id),
      ).toThrow(/owner_user_id harus sama dengan owner proyek/);
    });

    it('menolak pesan dengan conversation yang tidak ada (trigger ownership)', () => {
      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO messages (id, conversation_id, project_id, owner_user_id, role, sequence)
             VALUES (?, ?, ?, ?, 'user', 1)`,
          )
          .run('pesan-yatim', 'percakapan-tidak-ada', aliceProject.id, alice.id),
      ).toThrow(/owner dan project yang sama dengan percakapan/);
    });

    it('menolak percakapan milik Bob di dalam proyek Alice', () => {
      expect(() =>
        workspace.db
          .prepare(
            'INSERT INTO conversations (id, project_id, owner_user_id) VALUES (?, ?, ?)',
          )
          .run('percakapan-lintas-akun', aliceProject.id, bob.id),
      ).toThrow(/owner_user_id harus sama dengan owner proyek/);
    });

    it('menolak pesan milik Bob di dalam percakapan Alice', () => {
      const conversation = workspace.repositories.conversations.ensureDefault(
        aliceProject.id,
        alice.id,
      );

      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO messages (id, conversation_id, project_id, owner_user_id, role, sequence)
             VALUES (?, ?, ?, ?, 'user', 1)`,
          )
          .run('pesan-lintas-akun', conversation.id, aliceProject.id, bob.id),
      ).toThrow(/owner dan project yang sama dengan percakapan/);
    });

    it('menolak pemindahan percakapan ke proyek milik akun lain', () => {
      const conversation = workspace.repositories.conversations.ensureDefault(
        aliceProject.id,
        alice.id,
      );

      expect(() =>
        workspace.db
          .prepare('UPDATE conversations SET project_id = ? WHERE id = ?')
          .run(bobProject.id, conversation.id),
      ).toThrow(/owner_user_id harus sama dengan owner proyek/);
    });
  });

  describe('CHECK constraint', () => {
    it('menolak status proyek yang tidak dikenal', () => {
      expect(() =>
        workspace.db
          .prepare('UPDATE projects SET status = ? WHERE id = ?')
          .run('dihapus', aliceProject.id),
      ).toThrow(/CHECK constraint failed/);
    });

    it('menolak status arsip tanpa archived_at dan sebaliknya', () => {
      expect(() =>
        workspace.db
          .prepare('UPDATE projects SET status = ? WHERE id = ?')
          .run('archived', aliceProject.id),
      ).toThrow(/CHECK constraint failed/);

      expect(() =>
        workspace.db
          .prepare('UPDATE projects SET archived_at = ? WHERE id = ?')
          .run(new Date().toISOString(), bobProject.id),
      ).toThrow(/CHECK constraint failed/);
    });

    it('menolak role pengguna di luar admin/member', () => {
      expect(() =>
        workspace.db
          .prepare('UPDATE users SET role = ? WHERE id = ?')
          .run('owner', alice.id),
      ).toThrow(/CHECK constraint failed/);
    });

    it('menolak record file aktif tanpa ukuran final', () => {
      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO stored_files (
               id, owner_user_id, scope, state, original_name, relative_path,
               size_bytes, content_hash
             ) VALUES (?, ?, 'attachment', 'active', ?, ?, 0, ?)`,
          )
          .run(
            'file-tanpa-ukuran',
            alice.id,
            'berkas.txt',
            'ab/cd/file-tanpa-ukuran.txt',
            'a'.repeat(64),
          ),
      ).toThrow(/CHECK constraint failed/);
    });

    it('menolak record file terhapus tanpa deleted_at', () => {
      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO stored_files (
               id, owner_user_id, scope, state, original_name, relative_path,
               size_bytes, content_hash
             ) VALUES (?, ?, 'attachment', 'deleted', ?, ?, 10, ?)`,
          )
          .run(
            'file-terhapus',
            alice.id,
            'berkas.txt',
            'ab/cd/file-terhapus.txt',
            'b'.repeat(64),
          ),
      ).toThrow(/CHECK constraint failed/);
    });
  });

  describe('Unik dan urutan', () => {
    it('username unik tanpa membedakan kapitalisasi', () => {
      expect(() =>
        workspace.repositories.users.create({
          username: 'ALICE',
          displayName: 'Alice Palsu',
          passwordHash: 'scrypt$fake$hash',
        }),
      ).toThrow(/sudah ada/);
    });

    it('slug proyek unik per pemilik, tetapi boleh sama antar pemilik', () => {
      const aliceCopy = workspace.repositories.projects.create({
        ownerUserId: alice.id,
        name: 'Proyek Alice',
      });
      const bobCopy = workspace.repositories.projects.create({
        ownerUserId: bob.id,
        name: 'Proyek Alice',
      });

      expect(aliceCopy.slug).not.toBe(aliceProject.slug);
      expect(aliceCopy.slug.startsWith('proyek-alice')).toBe(true);
      expect(bobCopy.slug).not.toBe(aliceCopy.slug);
    });

    it('urutan pesan unik di dalam satu percakapan', () => {
      const conversation = workspace.repositories.conversations.ensureDefault(
        bobProject.id,
        bob.id,
      );
      const message = workspace.repositories.messages.createWithSequence({
        conversationId: conversation.id,
        projectId: bobProject.id,
        ownerUserId: bob.id,
        role: 'user',
        content: 'halo',
      });

      expect(message.sequence).toBe(1);

      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO messages (id, conversation_id, project_id, owner_user_id, role, sequence)
             VALUES (?, ?, ?, ?, 'user', ?)`,
          )
          .run('pesan-urutan-ganda', conversation.id, bobProject.id, bob.id, 1),
      ).toThrow(/UNIQUE constraint failed/);
    });

    it('hanya satu percakapan default per proyek', () => {
      const project = workspace.repositories.projects.create({
        ownerUserId: bob.id,
        name: 'Proyek Default Ganda',
      });

      workspace.repositories.conversations.create({
        projectId: project.id,
        ownerUserId: bob.id,
        isDefault: true,
      });

      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO conversations (id, project_id, owner_user_id, is_default)
             VALUES (?, ?, ?, 1)`,
          )
          .run('default-ganda', project.id, bob.id),
      ).toThrow(/UNIQUE constraint failed/);
    });

    it('app_settings unik per scope+owner+key dan menolak scope tidak konsisten', () => {
      workspace.repositories.settings.setInstance({ key: 'ui.theme_default', value: 'dark' });
      workspace.repositories.settings.setInstance({ key: 'ui.theme_default', value: 'light' });

      expect(workspace.repositories.settings.getInstance('ui.theme_default').value).toBe('light');

      expect(() =>
        workspace.db
          .prepare(
            `INSERT INTO app_settings (id, scope, owner_user_id, key, value)
             VALUES (?, 'instance', ?, 'kunci', 'nilai')`,
          )
          .run('setting-tidak-konsisten', alice.id),
      ).toThrow(/CHECK constraint failed/);
    });
  });

  describe('PRAGMA integrity_check', () => {
    it('lulus setelah seluruh operasi di atas', () => {
      expect(workspace.db.pragma('integrity_check', { simple: true })).toBe('ok');
    });
  });

  describe('Isolasi query per pemilik', () => {
    it('proyek tidak dapat dibaca oleh pemilik lain lewat repository', () => {
      expect(workspace.repositories.projects.findOwned(aliceProject.id, bob.id)).toBeNull();
      expect(workspace.repositories.projects.findOwned(aliceProject.id, alice.id)).not.toBeNull();
    });

    it('daftar proyek hanya berisi milik pemilik yang diminta', () => {
      const aliceList = workspace.repositories.projects.listByOwner(alice.id);
      const bobList = workspace.repositories.projects.listByOwner(bob.id);

      expect(aliceList.every((p) => p.ownerUserId === alice.id)).toBe(true);
      expect(bobList.every((p) => p.ownerUserId === bob.id)).toBe(true);
      expect(aliceList.map((p) => p.id)).not.toContain(bobProject.id);
    });

    it('pesan tidak dapat dibaca dengan owner yang salah', () => {
      const conversation = workspace.repositories.conversations.ensureDefault(
        aliceProject.id,
        alice.id,
      );
      const message = workspace.repositories.messages.createWithSequence({
        conversationId: conversation.id,
        projectId: aliceProject.id,
        ownerUserId: alice.id,
        role: 'user',
        content: 'pesan alice',
      });

      expect(workspace.repositories.messages.findOwned(message.id, bob.id)).toBeNull();
      expect(workspace.repositories.messages.listByConversation(conversation.id, bob.id)).toEqual(
        [],
      );
      expect(workspace.repositories.messages.findOwned(message.id, alice.id).content).toBe(
        'pesan alice',
      );
    });

    it('percakapan tidak dapat dibaca oleh pemilik lain', () => {
      const conversation = workspace.repositories.conversations.ensureDefault(
        aliceProject.id,
        alice.id,
      );

      expect(workspace.repositories.conversations.findOwned(conversation.id, bob.id)).toBeNull();
      expect(
        workspace.repositories.conversations.listByProject(aliceProject.id, bob.id),
      ).toEqual([]);
    });
  });
});

describe('Fixture proyek', () => {
  it('membuat pengguna, proyek, dan percakapan default yang konsisten', () => {
    const workspace = createTestWorkspace();
    try {
      const { user, project, conversation } = seedProjectFixture(workspace.repositories);

      expect(project.ownerUserId).toBe(user.id);
      expect(conversation.projectId).toBe(project.id);
      expect(conversation.ownerUserId).toBe(user.id);
      expect(conversation.isDefault).toBe(true);

      expect(workspace.db.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      workspace.cleanup();
    }
  });
});