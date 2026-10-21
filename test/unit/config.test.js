import { describe, it, expect } from 'vitest';
import { configSchema, formatConfigError } from '../../src/config/schema.js';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  HOST: 'localhost',
  BASE_URL: 'http://localhost:3000/',
  SESSION_SECRET: 'a'.repeat(32),
  CSRF_SECRET: 'b'.repeat(32),
  LOG_LEVEL: 'info',
  DATABASE_URL: 'file:data/app.sqlite',
  FILE_STORAGE_PATH: 'data/files',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
};

describe('configSchema', () => {
  it('menerima konfigurasi development yang valid', () => {
    const result = configSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('menerima konfigurasi production yang valid', () => {
    const result = configSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'production',
      PORT: '8080',
      BASE_URL: 'https://rencanaku.ai/',
    });
    expect(result.success).toBe(true);
  });

  it('mengonversi PORT string menjadi number', () => {
    const result = configSchema.safeParse({ ...validEnv, PORT: '8080' });
    expect(result.success).toBe(true);
    expect(result.data.PORT).toBe(8080);
    expect(typeof result.data.PORT).toBe('number');
  });

  it('memberi PORT default bertipe number saat variabel tidak diisi', () => {
    const { PORT, ...withoutPort } = validEnv;
    const result = configSchema.safeParse(withoutPort);
    expect(result.success).toBe(true);
    expect(result.data.PORT).toBe(3000);
    expect(typeof result.data.PORT).toBe('number');
  });

  it('mengonversi rate limit menjadi number termasuk nilai default', () => {
    const {
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS,
      ...withoutRateLimit
    } = validEnv;
    const result = configSchema.safeParse(withoutRateLimit);
    expect(result.success).toBe(true);
    expect(result.data.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(result.data.RATE_LIMIT_MAX_REQUESTS).toBe(100);
    expect(typeof result.data.RATE_LIMIT_MAX_REQUESTS).toBe('number');
  });

  it('menolak NODE_ENV yang tidak dikenal', () => {
    const result = configSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
    expect(formatConfigError(result.error)[0].field).toBe('NODE_ENV');
  });

  it('menolak PORT yang bukan angka', () => {
    const result = configSchema.safeParse({ ...validEnv, PORT: 'abc' });
    expect(result.success).toBe(false);
    expect(formatConfigError(result.error)[0].field).toBe('PORT');
  });

  it('menolak PORT di luar rentang', () => {
    const result = configSchema.safeParse({ ...validEnv, PORT: '70000' });
    expect(result.success).toBe(false);
    expect(formatConfigError(result.error)[0].field).toBe('PORT');
  });

  it('menolak secret yang hilang', () => {
    const { SESSION_SECRET, CSRF_SECRET, ...withoutSecrets } = validEnv;
    const result = configSchema.safeParse(withoutSecrets);
    expect(result.success).toBe(false);
    const fields = formatConfigError(result.error).map((e) => e.field);
    expect(fields).toContain('SESSION_SECRET');
    expect(fields).toContain('CSRF_SECRET');
  });

  it('menolak secret yang terlalu pendek', () => {
    const result = configSchema.safeParse({
      ...validEnv,
      SESSION_SECRET: 'pendek',
    });
    expect(result.success).toBe(false);
    expect(formatConfigError(result.error)[0].field).toBe('SESSION_SECRET');
  });

  it('formatConfigError tidak membocorkan nilai input', () => {
    const secretValue = 'super-rahasia-tapi-pendek';
    const result = configSchema.safeParse({
      ...validEnv,
      SESSION_SECRET: secretValue,
    });
    expect(result.success).toBe(false);
    const serialized = JSON.stringify(formatConfigError(result.error));
    expect(serialized).not.toContain(secretValue);
  });
});
