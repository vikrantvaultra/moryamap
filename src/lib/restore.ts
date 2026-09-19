import { randomBytes, randomInt } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { SEVA_AMOUNT, type SevaConfig, passMaxAge, razorpay } from '@/lib/seva';

/**
 * Restore codes: someone paid ₹21 in one browser and now uses another (new
 * phone, cleared cookies, opened the link in a different app). An admin checks
 * the payment on Razorpay and issues a code; the code unlocks exactly ONE
 * browser.
 *
 * The first browser to redeem a code claims it (Redis SET NX with that
 * browser's device id). Entering the same code again in that browser works;
 * any other browser is refused, so a forwarded code is worthless. Issuing a
 * new code for a payment revokes that payment's unused ones, and the admin
 * page shows every code a payment has had, so repeat requests stand out.
 */

/** No 0/O, 1/I/L: codes get read out over the phone and typed from screenshots. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
export const DEVICE_COOKIE = 'morya_seva_device';

const codeKey = (code: string) => `morya:seva:restore:code:${code}`;
const claimKey = (code: string) => `morya:seva:restore:claim:${code}`;
const paymentKey = (paymentId: string) => `morya:seva:restore:pay:${paymentId}`;

interface CodeRecord {
  paymentId: string;
  issuedAt: number;
}

/** Eight random characters, e.g. "K7QM-3XPA" (shown with a dash, stored without). */
export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Canonical form of whatever the user typed, or null if it can't be a code. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

export function isPaymentId(value: string): boolean {
  return /^pay_[A-Za-z0-9]{8,24}$/.test(value);
}

// --- Payment check (admin) ---------------------------------------------------

export interface SevaPayment {
  id: string;
  amount: number;
  status: string;
  createdAt: number;
  method: string | null;
  vpa: string | null;
}

export type PaymentProblem = 'bad_id' | 'not_found' | 'not_captured' | 'refunded' | 'wrong_amount';

interface RazorpayPaymentEntity {
  id: string;
  amount: number;
  amount_refunded?: number;
  status: string;
  created_at: number;
  method?: string;
  vpa?: string | null;
}

/** A captured, unrefunded ₹21 payment on our Razorpay account — or why not. */
export async function checkSevaPayment(
  cfg: SevaConfig,
  paymentId: string,
): Promise<{ ok: true; payment: SevaPayment } | { ok: false; problem: PaymentProblem }> {
  if (!isPaymentId(paymentId)) return { ok: false, problem: 'bad_id' };
  let p: RazorpayPaymentEntity;
  try {
    p = await razorpay<RazorpayPaymentEntity>(cfg, `/payments/${paymentId}`);
  } catch (err) {
    console.error(err);
    return { ok: false, problem: 'not_found' };
  }
  if ((p.amount_refunded ?? 0) > 0 || p.status === 'refunded') return { ok: false, problem: 'refunded' };
  if (p.status !== 'captured') return { ok: false, problem: 'not_captured' };
  // ₹500 / ₹501 payments are darshan and ashirwad, not the seva unlock.
  if (p.amount !== SEVA_AMOUNT * 100) return { ok: false, problem: 'wrong_amount' };
  return {
    ok: true,
    payment: {
      id: p.id,
      amount: p.amount,
      status: p.status,
      createdAt: p.created_at,
      method: p.method ?? null,
      vpa: p.vpa ?? null,
    },
  };
}

// --- Issuing (admin) ---------------------------------------------------------

export type CodeStatus = 'unused' | 'used' | 'revoked';

export interface IssuedCode {
  code: string;
  status: CodeStatus;
}

/** Codes issued for a payment, newest first. */
export async function codesForPayment(paymentId: string): Promise<IssuedCode[]> {
  const redis = getRedis();
  if (!redis) return [];
  const codes = await redis.lrange<string>(paymentKey(paymentId), 0, -1);
  return Promise.all(
    codes.map(async (code) => {
      const [record, claim] = await Promise.all([
        redis.get<CodeRecord>(codeKey(code)),
        redis.get<string>(claimKey(code)),
      ]);
      const status: CodeStatus = claim ? 'used' : record ? 'unused' : 'revoked';
      return { code, status };
    }),
  );
}

/** Deletes a code nobody has redeemed yet. A redeemed one stays with its browser. */
export async function revokeCode(code: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error('[restore] Redis is required');
  if (!(await redis.exists(claimKey(code)))) await redis.del(codeKey(code));
}

/** A fresh code for a verified payment; any unused earlier code stops working. */
export async function issueCode(paymentId: string): Promise<string> {
  const redis = getRedis();
  if (!redis) throw new Error('[restore] Redis is required');
  const ttl = passMaxAge();

  for (const old of await redis.lrange<string>(paymentKey(paymentId), 0, -1)) {
    await revokeCode(old);
  }

  const record: CodeRecord = { paymentId, issuedAt: Date.now() };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    if (await redis.set(codeKey(code), record, { nx: true, ex: ttl })) {
      await redis.lpush(paymentKey(paymentId), code);
      await redis.expire(paymentKey(paymentId), ttl);
      return code;
    }
  }
  throw new Error('[restore] could not find a free code');
}

// --- Redeeming (user) --------------------------------------------------------

export type RedeemResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: 'invalid' | 'used' };

/**
 * Binds the code to this device on first use. The claim is a single SET NX,
 * so two browsers racing with the same code can't both win.
 */
export async function redeemCode(code: string, deviceId: string): Promise<RedeemResult> {
  const redis = getRedis();
  if (!redis) throw new Error('[restore] Redis is required');
  const record = await redis.get<CodeRecord>(codeKey(code));
  if (!record) return { ok: false, error: 'invalid' };
  const claimed = await redis.set(claimKey(code), deviceId, { nx: true, ex: passMaxAge() });
  if (!claimed && (await redis.get<string>(claimKey(code))) !== deviceId) {
    return { ok: false, error: 'used' };
  }
  return { ok: true, paymentId: record.paymentId };
}

/** This browser's id for claiming codes: kept if present, minted otherwise. */
export function deviceId(req: NextRequest): string {
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{22}$/.test(existing)) return existing;
  return randomBytes(16).toString('base64url');
}

export function setDeviceCookie(res: NextResponse, id: string): void {
  res.cookies.set(DEVICE_COOKIE, id, {
    path: '/api/donate',
    maxAge: passMaxAge(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
