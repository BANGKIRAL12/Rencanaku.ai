import { describe, it, expect } from 'vitest';

describe('Sanity & Runtime Vitest Test', () => {
  it('berjalan dalam mode ESM murni', () => {
    expect(import.meta.url).toBeDefined();
    expect(typeof import.meta.url).toBe('string');
  });

  it('menjalankan assertion matematika dan tipe dasar', () => {
    const sum = (a, b) => a + b;
    expect(sum(20, 24)).toBe(44);
    expect(true).toBe(true);
  });
});
