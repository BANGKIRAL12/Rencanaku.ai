#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';

console.log('--- Menjalankan Doctor Rencanaku.ai ---');

// 1. Verifikasi Versi Node
const currentVersion = process.version.replace(/^v/, '');
const nvmrcPath = path.resolve('.nvmrc');
if (fs.existsSync(nvmrcPath)) {
  const targetVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();
  if (currentVersion === targetVersion) {
    console.log(`[OK] Versi Node (${process.version}) cocok dengan .nvmrc (${targetVersion})`);
  } else {
    console.warn(`[WARN] Versi Node (${process.version}) berbeda dengan .nvmrc (${targetVersion})`);
  }
} else {
  console.warn('[WARN] File .nvmrc tidak ditemukan');
}

// 2. Verifikasi better-sqlite3 Native Addon
try {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE doctor_test (id INTEGER PRIMARY KEY, item TEXT)');
  const insert = db.prepare('INSERT INTO doctor_test (item) VALUES (?)');
  insert.run('koneksi_db_sukses');
  const row = db.prepare('SELECT item FROM doctor_test WHERE id = 1').get();
  db.close();
  if (row && row.item === 'koneksi_db_sukses') {
    console.log('[OK] better-sqlite3 berjalan normal (in-memory test lulus)');
  } else {
    throw new Error('Hasil query in-memory tidak sesuai');
  }
} catch (err) {
  console.error('[FAIL] better-sqlite3 gagal dijalankan:', err.message);
  process.exit(1);
}

// 3. Verifikasi ESM Mode
if (import.meta.url) {
  console.log('[OK] ESM runtime aktif');
}

console.log('--- Doctor selesai: Lingkungan siap digunakan ---');
