import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  ASHIRWAD_AMOUNT,
  ashirwad,
  daysUntilVisarjan,
  devUnlockEnabled,
  isAshirwadAmount,
} from './ashirwad';
import { type SevaConfig, signToken } from './seva';

const cfg: SevaConfig = {
  keyId: 'rzp_test_key',
  keySecret: 'rzp_test_secret',
  webhookSecret: null,
  beneficiary: 'Test Beneficiary',
};

/** Just enough of a NextRequest for the cookie readers. */
function reqWith(cookies: Record<string, string>): NextRequest {
  return { cookies: { get: (name: string) => (name in cookies ? { value: cookies[name] } : undefined) } } as unknown as NextRequest;
}

describe('the price', () => {
  it('is 501 — shagun — and nothing else', () => {
    expect(ASHIRWAD_AMOUNT).toBe(501);
    expect(isAshirwadAmount(501)).toBe(true);
    expect(isAshirwadAmount(500)).toBe(false);
    expect(isAshirwadAmount(21)).toBe(false);
    expect(isAshirwadAmount('501')).toBe(false);
  });
});

describe('the ashirwad pass', () => {
  it('accepts a pass this flow minted with our key', () => {
    const token = signToken('ashirwad:pay_ABC123.1758300000', cfg.keySecret);
    expect(ashirwad.hasPass(token, cfg)).toBe(true);
  });

  it('rejects missing, junk, tampered and foreign-signed passes', () => {
    const token = signToken('ashirwad:pay_ABC123.1758300000', cfg.keySecret);
    expect(ashirwad.hasPass(undefined, cfg)).toBe(false);
    expect(ashirwad.hasPass('', cfg)).toBe(false);
    expect(ashirwad.hasPass('ashirwad:pay_ABC123.1758300000', cfg)).toBe(false);
    expect(ashirwad.hasPass(token.replace('pay_ABC123', 'pay_EVIL'), cfg)).toBe(false);
    expect(ashirwad.hasPass(token, { ...cfg, keySecret: 'someone_elses_secret' })).toBe(false);
  });

  it('is not opened by a ₹21 seva pass or a ₹500 darshan pass pasted into its cookie', () => {
    // Both are signed with the same key but carry no ashirwad scope. The seva
    // cookie is readable by page script, so this is a real, easy attempt.
    const seva = signToken('pay_SEVA21.1758300000', cfg.keySecret);
    const darshan = signToken('pay_DARSHAN500.1758300000', cfg.keySecret);
    expect(ashirwad.hasPass(seva, cfg)).toBe(false);
    expect(ashirwad.hasPass(darshan, cfg)).toBe(false);
  });
});

describe('the receipt', () => {
  it('reads the payment id back out of a valid pass, and nothing out of a foreign one', () => {
    const mine = signToken('ashirwad:pay_ABC123.1758300000', cfg.keySecret);
    const seva = signToken('pay_SEVA21.1758300000', cfg.keySecret);
    expect(ashirwad.passRef(mine, cfg)).toBe('pay_ABC123');
    expect(ashirwad.passRef(seva, cfg)).toBeNull();
    expect(ashirwad.passRef(undefined, cfg)).toBeNull();
  });
});

describe('pending orders', () => {
  it('reads back ids this flow stored', () => {
    const token = signToken('ashirwad-pending:order_A,qr_B', cfg.keySecret);
    const req = reqWith({ morya_ashirwad_pending: token });
    expect(ashirwad.readPending(req, cfg)).toEqual(['order_A', 'qr_B']);
  });

  it('ignores another flow’s pending list, so a paid ₹21 order can’t be replayed as ₹501', () => {
    const sevaPending = signToken('order_PAID21', cfg.keySecret);
    const req = reqWith({ morya_ashirwad_pending: sevaPending });
    expect(ashirwad.readPending(req, cfg)).toEqual([]);
  });
});

describe('days until Bappa goes home (Anant Chaturdashi, 25 Sep 2026, IST)', () => {
  it('counts IST calendar days', () => {
    expect(daysUntilVisarjan(new Date('2026-09-19T06:00:00Z'))).toBe(6);
    expect(daysUntilVisarjan(new Date('2026-09-24T12:00:00Z'))).toBe(1);
    expect(daysUntilVisarjan(new Date('2026-09-25T00:00:00Z'))).toBe(0);
    expect(daysUntilVisarjan(new Date('2026-09-26T10:00:00Z'))).toBe(-1);
  });

  it('turns over at IST midnight, not UTC midnight', () => {
    // 19:00 UTC on the 24th is 00:30 IST on the 25th.
    expect(daysUntilVisarjan(new Date('2026-09-24T19:00:00Z'))).toBe(0);
  });
});

describe('local test mode', () => {
  const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

  it('is on under next dev only', () => {
    expect(devUnlockEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
  });

  it('is never on in production (Vercel, next start) or in tests', () => {
    expect(devUnlockEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(devUnlockEnabled(env({ NODE_ENV: 'test' }))).toBe(false);
    expect(devUnlockEnabled(env({}))).toBe(false);
  });

  it('can be switched off locally to test real Razorpay payments', () => {
    expect(devUnlockEnabled(env({ NODE_ENV: 'development', ASHIRWAD_DEV_PAYMENTS: '1' }))).toBe(false);
  });
});
