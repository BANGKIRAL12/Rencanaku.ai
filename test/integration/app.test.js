import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config/env.js';

describe('App Integration Tests', () => {
  let app;

  beforeEach(() => {
    // Buat instance app baru untuk setiap test
    app = createApp();
  });

  describe('Configuration Validation', () => {
    it('should validate config successfully', () => {
      expect(config).toBeDefined();
      // Vitest runs in test mode by default
      expect(config.NODE_ENV).toBe('test');
      expect(config.PORT).toBe(3000);
    });
  });

  describe('Health Endpoints', () => {
    it('should respond to /health/live', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'alive');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });

    it('should respond to /health/ready', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ready');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('Page Routes', () => {
    it('should serve the home page', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>');
    });

    it('should return 404 for non-existent page', async () => {
      const res = await request(app).get('/non-existent-page');
      expect(res.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON errors gracefully', async () => {
      const res = await request(app)
        .get('/health/nonexistent')
        .set('Accept', 'application/json');
      
      expect(res.status).toBe(404);
      // Note: Our custom error handler doesn't send error object for JSON requests
      // This test might need adjustment based on actual behavior
    });
  });
});