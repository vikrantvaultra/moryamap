import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory stand-in for the Upstash calls restore.ts makes.
const store = new Map<string, unknown>();
const fakeRedis = {
  get: async (k: string) => store.get(k) ?? null,
  set: async (k: string, v: unknown, opts?: { nx?: boolean }) => {
    if (opts?.nx && store.has(k)) return null;
    store.set(k, v);
    return 'OK';
  },
  del: async (k: string) => Number(store.delete(k)),
  exists: async (k: string) => Number(store.has(k)),
  lrange: async (k: string) => [...((store.get(k) as string[] | undefined) ?? [])],
  lpush: async (k: string, v: string) => {
    store.set(k, [v, ...((store.get(k) as string[] | undefined) ?? [])]);
  },
  expire: async () => 1,
};
vi.mock('@/lib/redis', () => ({ getRedis: () => fakeRedis }));

const {
  codesForPayment,
  formatCode,
  generateCode,
  isPaymentId,
  issueCode,
  normalizeCode,
  redeemCode,
  revokeCode,
} = await import('./restore');

beforeEach(() => store.clear());

describe('code format', () => {
  it('generates 8 unambiguous characters that normalize to themselves', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
      expect(normalizeCode(code)).toBe(code);
      expect(normalizeCode(formatCode(code))).toBe(code);
    }
  });

  it('accepts what people type: lower case, spaces, dashes', () => {
    expect(normalizeCode(' k7qm-3xpa ')).toBe('K7QM3XPA');
    expect(normalizeCode('K7QM 3XPA')).toBe('K7QM3XPA');
  });

  it('rejects wrong lengths, ambiguous characters and non-strings', () => {
    expect(normalizeCode('K7QM3XP')).toBeNull();
    expect(normalizeCode('K7QM3XPAA')).toBeNull();
    expect(normalizeCode('K7QM3XP0')).toBeNull();
    expect(normalizeCode('K7QM3XPI')).toBeNull();
    expect(normalizeCode(12345678)).toBeNull();
    expect(normalizeCode(undefined)).toBeNull();
  });

  it('recognises Razorpay payment ids only', () => {
    expect(isPaymentId('pay_Q1a2B3c4D5e6F7')).toBe(true);
    expect(isPaymentId('order_Q1a2B3c4D5e6F7')).toBe(false);
    expect(isPaymentId('pay_')).toBe(false);
    expect(isPaymentId('pay_abc/../x')).toBe(false);
  });
});

describe('one code, one browser', () => {
  it('unlocks the first browser, again in that browser, and never in another', async () => {
    const code = await issueCode('pay_AAAAAAAAAAAAAA');
    expect(await redeemCode(code, 'browser-one')).toEqual({ ok: true, paymentId: 'pay_AAAAAAAAAAAAAA' });
    expect(await redeemCode(code, 'browser-one')).toEqual({ ok: true, paymentId: 'pay_AAAAAAAAAAAAAA' });
    expect(await redeemCode(code, 'browser-two')).toEqual({ ok: false, error: 'used' });
  });

  it('rejects codes that were never issued', async () => {
    expect(await redeemCode('ABCDEFGH', 'browser-one')).toEqual({ ok: false, error: 'invalid' });
  });

  it('a new code revokes the unused old one but leaves a used one with its browser', async () => {
    const pay = 'pay_BBBBBBBBBBBBBB';
    const first = await issueCode(pay);
    await redeemCode(first, 'browser-one');
    const second = await issueCode(pay);
    const third = await issueCode(pay);

    expect(await redeemCode(second, 'browser-two')).toEqual({ ok: false, error: 'invalid' });
    expect(await redeemCode(first, 'browser-one')).toMatchObject({ ok: true });
    expect(await codesForPayment(pay)).toEqual([
      { code: third, status: 'unused' },
      { code: second, status: 'revoked' },
      { code: first, status: 'used' },
    ]);
  });

  it('revoking a redeemed code does nothing', async () => {
    const code = await issueCode('pay_CCCCCCCCCCCCCC');
    await redeemCode(code, 'browser-one');
    await revokeCode(code);
    expect(await redeemCode(code, 'browser-one')).toMatchObject({ ok: true });
  });
});
