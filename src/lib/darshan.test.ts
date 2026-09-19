import { describe, expect, it } from 'vitest';
import { DARSHAN_AMOUNT, hasDarshanPass, isDarshanAmount } from './darshan';
import { signToken } from './seva';
import type { SevaConfig } from './seva';

const cfg: SevaConfig = {
  keyId: 'rzp_test_key',
  keySecret: 'rzp_test_secret',
  webhookSecret: null,
  beneficiary: 'Test Mandal',
};

describe('the darshan pass', () => {
  it('accepts a pass signed with our own key', () => {
    const token = signToken('pay_ABC123.1757900000', cfg.keySecret);
    expect(hasDarshanPass(token, cfg)).toBe(true);
  });

  it('rejects a missing, junk, tampered or foreign-signed pass', () => {
    const token = signToken('pay_ABC123.1757900000', cfg.keySecret);
    expect(hasDarshanPass(undefined, cfg)).toBe(false);
    expect(hasDarshanPass('', cfg)).toBe(false);
    expect(hasDarshanPass('pay_ABC123.1757900000', cfg)).toBe(false);
    expect(hasDarshanPass(token.replace('pay_ABC123', 'pay_EVIL'), cfg)).toBe(false);
    expect(hasDarshanPass(token, { ...cfg, keySecret: 'someone_elses_secret' })).toBe(false);
  });
});

describe('the price', () => {
  it('is 500 and nothing else', () => {
    expect(DARSHAN_AMOUNT).toBe(500);
    expect(isDarshanAmount(500)).toBe(true);
    // A caller must not be able to talk the server down to the ₹21 seva price.
    expect(isDarshanAmount(21)).toBe(false);
    expect(isDarshanAmount(1)).toBe(false);
    expect(isDarshanAmount('500')).toBe(false);
    expect(isDarshanAmount(null)).toBe(false);
  });
});
