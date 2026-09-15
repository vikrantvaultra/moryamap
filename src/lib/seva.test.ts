import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  FESTIVAL_END_MS,
  isSevaAmount,
  passMaxAge,
  readToken,
  signToken,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from './seva';

const SECRET = 'rzp_test_secret';

describe('signed tokens', () => {
  it('round-trips a value, including ones containing dots', () => {
    const token = signToken('pay_ABC123.1757900000', SECRET);
    expect(readToken(token, SECRET)).toBe('pay_ABC123.1757900000');
  });

  it('rejects tampering, a different secret and junk', () => {
    const token = signToken('qr_one,order_two', SECRET);
    expect(readToken(token.replace('qr_one', 'qr_evil'), SECRET)).toBeNull();
    expect(readToken(token, 'other_secret')).toBeNull();
    expect(readToken(undefined, SECRET)).toBeNull();
    expect(readToken('no-signature', SECRET)).toBeNull();
    expect(readToken('.sigonly', SECRET)).toBeNull();
  });

  it('does not reuse the Razorpay secret directly as the cookie key', () => {
    const naive = createHmac('sha256', SECRET).update('v').digest('base64url');
    expect(signToken('v', SECRET)).not.toBe(`v.${naive}`);
  });
});

describe('Razorpay signatures', () => {
  it('verifies Checkout order|payment signatures', () => {
    const sig = createHmac('sha256', SECRET).update('order_1|pay_1').digest('hex');
    expect(verifyCheckoutSignature('order_1', 'pay_1', sig, SECRET)).toBe(true);
    expect(verifyCheckoutSignature('order_2', 'pay_1', sig, SECRET)).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', 'short', SECRET)).toBe(false);
  });

  it('verifies webhook bodies', () => {
    const body = '{"event":"qr_code.credited"}';
    const sig = createHmac('sha256', 'whsec').update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, 'whsec')).toBe(true);
    expect(verifyWebhookSignature(`${body} `, sig, 'whsec')).toBe(false);
  });
});

describe('isSevaAmount', () => {
  it('only accepts the unlock price', () => {
    expect(isSevaAmount(21)).toBe(true);
    for (const a of [0, 1, 11, 20, 51, 101, '21', null, 21.5]) expect(isSevaAmount(a)).toBe(false);
  });
});

describe('passMaxAge', () => {
  it('lasts until the festival ends', () => {
    const now = FESTIVAL_END_MS - 5 * 24 * 60 * 60 * 1000;
    expect(passMaxAge(now)).toBe(5 * 24 * 60 * 60);
  });

  it('never drops below a day', () => {
    expect(passMaxAge(FESTIVAL_END_MS - 60_000)).toBe(24 * 60 * 60);
    expect(passMaxAge(FESTIVAL_END_MS + 10 * 24 * 60 * 60 * 1000)).toBe(24 * 60 * 60);
  });
});
