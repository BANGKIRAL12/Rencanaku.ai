import { describe, it, expect, vi } from 'vitest';
import { configSchema } from '../../src/config/schema.js';

describe('Config Schema Validation', () => {
  describe('Valid configurations', () => {
    it('should validate basic config', () => {
      const validConfig = {
        NODE_ENV: 'development',
        PORT: '3000',
        HOST: 'localhost',
        BASE_URL: 'http://localhost:3000',
        SESSION_SECRET: 'a'.repeat(32),
        CSRF_SECRET: 'b'.repeat(32),
        LOG_LEVEL: 'info',
        DATABASE_URL: 'file:data/app.sqlite',
        FILE_STORAGE_PATH: 'data/files',
        RATE_LIMIT_WINDOW_MS: '900000',
        RATE_LIMIT_MAX_REQUESTS: '100',
      };

      const result = configSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should validate production config', () => {
      const validConfig = {
        NODE_ENV: 'production',
        PORT: '8080',
        HOST: '0.0.0.0',
        BASE_URL: 'https://rencanaku.ai',
        SESSION_SECRET: 'a'.repeat(32),
        CSRF_SECRET: 'b'.repeat(32),
        LOG_LEVEL: 'warn',
        DATABASE_URL: 'file:data/app.sqlite',
        FILE_STORAGE_PATH: 'data/files',
        RATE_LIMIT_WINDOW_MS: '3600000',
        RATE_LIMIT_MAX_REQUESTS: '500',
      };

      const result = configSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid configurations', () => {
    it('should reject invalid NODE_ENV', () => {
      const invalidConfig = {
        NODE_ENV: 'invalid-env',
        PORT: '3000',
        SESSION_SECRET: 'a'.repeat(32),
        CSRF_SECRET: 'b'.repeat(32),
      };

      const result = configSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('NODE_ENV');
      }
    });

    it('should reject invalid PORT', () => {
      const invalidConfig = {
        NODE_ENV: 'development',
        PORT: 'not-a-number',
        SESSION_SECRET: 'a'.repeat(32),
        CSRF_SECRET: 'b'.repeat(32),
      };

      const result = configSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('PORT');
      }
    });

    it('should reject missing required fields', () => {
      const invalidConfig = {
        NODE_ENV: 'development',
        PORT: '3000',
        // Missing SESSION_SECRET and CSRF_SECRET
      };

      const result = configSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject short SESSION_SECRET', () => {
      const invalidConfig = {
        NODE_ENV: 'development',
        PORT: '3000',
        SESSION_SECRET: 'short',
        CSRF_SECRET: 'b'.repeat(32),
      };

      const result = configSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('SESSION_SECRET');
      }
    });
  });
});