import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

describe('better-sqlite3 Smoke Test', () => {
  it('berhasil membuka database sementara, menulis, membaca, dan menutup koneksi', () => {
    const tempDir = fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : '/tmp';
    const tempDbPath = path.join(tempDir, `smoke-test-${Date.now()}.db`);

    try {
      const db = new Database(tempDbPath);
      expect(db.open).toBe(true);

      // Jalankan skema dasar dan pragma
      db.pragma('foreign_keys = ON');
      db.exec(`
        CREATE TABLE smoke_check (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Tulis data (prepared statement)
      const insert = db.prepare('INSERT INTO smoke_check (name) VALUES (?)');
      const info = insert.run('Uji Fondasi Fase 0');
      expect(info.changes).toBe(1);
      expect(info.lastInsertRowid).toBe(1);

      // Baca data
      const read = db.prepare('SELECT id, name FROM smoke_check WHERE id = ?');
      const row = read.get(1);
      expect(row).toBeDefined();
      expect(row.name).toBe('Uji Fondasi Fase 0');

      // Tutup database
      db.close();
      expect(db.open).toBe(false);
    } finally {
      // Bersihkan file sementara
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
      const walPath = `${tempDbPath}-wal`;
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
      const shmPath = `${tempDbPath}-shm`;
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }
    }
  });

  it('dapat menangani database :memory: dengan baik', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE mem_check (val INTEGER);');
    db.prepare('INSERT INTO mem_check (val) VALUES (?)').run(42);
    const row = db.prepare('SELECT val FROM mem_check').get();
    expect(row.val).toBe(42);
    db.close();
  });
});
