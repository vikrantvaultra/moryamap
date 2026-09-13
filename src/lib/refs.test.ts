import { describe, expect, it } from 'vitest';
import { withUtm } from './refs';

describe('withUtm', () => {
  it('tags a bare URL', () => {
    expect(withUtm('https://x.test/m/lalbaugcha-raja', 'whatsapp')).toBe(
      'https://x.test/m/lalbaugcha-raja?utm_source=whatsapp&utm_medium=share',
    );
  });

  it('keeps existing params and the hash, and replaces an old source', () => {
    expect(withUtm('/plan?x=1&utm_source=copy#1-2', 'native')).toBe(
      '/plan?x=1&utm_source=native&utm_medium=share#1-2',
    );
  });
});
