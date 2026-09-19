import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

/**
 * Paid features: the mandal queue details (queue start, wait estimate,
 * holding points), pandal-hopping routes and the immersion pond finder are
 * locked until a one-time UPI payment, which unlocks them on this device for
 * the rest of the festival.
 * No accounts — the proof is a signed cookie.
 *
 * Payment confirmation is real (Razorpay API / webhook / checkout signature).
 * The lock itself is a client-side overlay on ISR pages, so it can't stop
 * someone who removes it in devtools; nothing without a login can.
 */

/** The one price for unlocking, in rupees. */
export const SEVA_AMOUNT = 21;
const SEVA_AMOUNTS: readonly number[] = [SEVA_AMOUNT];

/** Readable by the client so locked features can open without a request. */
export const PASS_COOKIE = 'morya_seva';
const PENDING_COOKIE = 'morya_seva_pending';
const PENDING_PATH = '/api/donate';
/** Midnight IST after the last day of Ganeshotsav 2026 (25 September). */
export const FESTIVAL_END_MS = Date.UTC(2026, 8, 25, 18, 30);
const MIN_PASS_MAX_AGE = 60 * 60 * 24;
const PENDING_MAX_AGE = 30 * 60;
const MAX_PENDING = 6;
export const QR_TTL_SECONDS = 15 * 60;

export interface SevaConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  beneficiary: string;
}

/** Null when Razorpay or the beneficiary isn't configured — the gate is off. */
export function sevaConfig(): SevaConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const beneficiary = process.env.SEVA_BENEFICIARY?.trim();
  if (!keyId || !keySecret || !beneficiary) return null;
  return {
    keyId,
    keySecret,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || null,
    beneficiary,
  };
}

export function isSevaAmount(value: unknown): value is number {
  return typeof value === 'number' && SEVA_AMOUNTS.includes(value);
}

/** Seconds until the festival ends, but never less than a day. */
export function passMaxAge(now = Date.now()): number {
  return Math.max(MIN_PASS_MAX_AGE, Math.floor((FESTIVAL_END_MS - now) / 1000));
}

// --- Signatures -------------------------------------------------------------

function hmacHex(key: string | Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Cookie key derived from the Razorpay secret, separate from its own use. */
function cookieKey(keySecret: string): Buffer {
  return createHmac('sha256', keySecret).update('morya-seva-cookie-v1').digest();
}

/** `value.signature` — value must not be empty. */
export function signToken(value: string, keySecret: string): string {
  const sig = createHmac('sha256', cookieKey(keySecret)).update(value).digest('base64url');
  return `${value}.${sig}`;
}

/** The signed value, or null if the token was tampered with. */
export function readToken(token: string | undefined, keySecret: string): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const value = token.slice(0, dot);
  return safeEqual(signToken(value, keySecret), token) ? value : null;
}

/** Razorpay Standard Checkout: HMAC-SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  return safeEqual(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Razorpay webhooks: HMAC-SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  return safeEqual(hmacHex(secret, rawBody), signature);
}

// --- Cookies ----------------------------------------------------------------

const secure = process.env.NODE_ENV === 'production';

/** Unlocks the paid features on this device until the festival ends. */
export function setPass(res: NextResponse, paymentRef: string, cfg: SevaConfig): void {
  const issued = Math.floor(Date.now() / 1000);
  res.cookies.set(PASS_COOKIE, signToken(`${paymentRef}.${issued}`, cfg.keySecret), {
    path: '/',
    maxAge: passMaxAge(),
    sameSite: 'lax',
    secure,
  });
  res.cookies.set(PENDING_COOKIE, '', { path: PENDING_PATH, maxAge: 0 });
}

/**
 * QR codes / orders created by this device, newest first. Status checks only
 * look at these, so a paid QR id shared by someone else unlocks nothing.
 */
export function readPending(req: NextRequest, cfg: SevaConfig): string[] {
  const value = readToken(req.cookies.get(PENDING_COOKIE)?.value, cfg.keySecret);
  return value ? value.split(',').filter(Boolean) : [];
}

export function addPending(req: NextRequest, res: NextResponse, id: string, cfg: SevaConfig): void {
  const ids = [id, ...readPending(req, cfg).filter((x) => x !== id)].slice(0, MAX_PENDING);
  res.cookies.set(PENDING_COOKIE, signToken(ids.join(','), cfg.keySecret), {
    path: PENDING_PATH,
    maxAge: PENDING_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure,
  });
}

// --- Razorpay API -----------------------------------------------------------

export async function razorpay<T>(cfg: SevaConfig, path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`[seva] razorpay ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

interface RazorpayQr {
  id: string;
  image_url: string;
  payment_amount: number;
  payments_amount_received: number;
  status: 'active' | 'closed';
  close_by: number;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  status: 'created' | 'attempted' | 'paid';
}

interface RazorpayPayment {
  id: string;
  status: string;
}

/** Single-use, fixed-amount UPI QR that closes after QR_TTL_SECONDS. */
export function createQr(cfg: SevaConfig, rupees: number): Promise<RazorpayQr> {
  return razorpay<RazorpayQr>(cfg, '/payments/qr_codes', {
    type: 'upi_qr',
    name: 'Morya Map seva',
    usage: 'single_use',
    fixed_amount: true,
    payment_amount: rupees * 100,
    description: `Offering to ${cfg.beneficiary}`.slice(0, 100),
    close_by: Math.floor(Date.now() / 1000) + QR_TTL_SECONDS,
    notes: { source: 'moryamap', rupees: String(rupees) },
  });
}

export function createOrder(cfg: SevaConfig, rupees: number): Promise<RazorpayOrder> {
  return razorpay<RazorpayOrder>(cfg, '/orders', {
    amount: rupees * 100,
    currency: 'INR',
    receipt: `seva-${Date.now()}`,
    notes: { source: 'moryamap', rupees: String(rupees) },
  });
}

/** Payment id if the QR or order has been paid in full, else null. */
async function paidDirect(cfg: SevaConfig, id: string): Promise<string | null> {
  if (id.startsWith('qr_')) {
    const qr = await razorpay<RazorpayQr>(cfg, `/payments/qr_codes/${id}`);
    if (qr.payments_amount_received < qr.payment_amount) return null;
    const { items } = await razorpay<{ items: RazorpayPayment[] }>(
      cfg,
      `/payments/qr_codes/${id}/payments`,
    );
    return items.find((p) => p.status === 'captured')?.id ?? id;
  }
  if (id.startsWith('order_')) {
    const order = await razorpay<RazorpayOrder>(cfg, `/orders/${id}`);
    if (order.status !== 'paid') return null;
    const { items } = await razorpay<{ items: RazorpayPayment[] }>(cfg, `/orders/${id}/payments`);
    return items.find((p) => p.status === 'captured')?.id ?? id;
  }
  return null;
}

// --- Payment marks (webhook → Redis) ----------------------------------------

const markKey = (id: string) => `morya:seva:paid:${id}`;

export async function markPaid(id: string, paymentId: string): Promise<void> {
  await getRedis()?.set(markKey(id), paymentId, { ex: 60 * 60 * 24 * 2 });
}

/**
 * Payment id for any of this device's pending QR codes / orders. Webhook
 * marks in Redis are free to read; the Razorpay API is the fallback, throttled
 * per id so a crowd of polling phones can't exhaust the account's rate limit.
 */
export async function findPaid(
  cfg: SevaConfig,
  ids: string[],
): Promise<{ id: string; paymentId: string } | null> {
  const redis = getRedis();
  for (const id of ids) {
    const marked = await redis?.get<string>(markKey(id));
    if (marked) return { id, paymentId: marked };
  }
  for (const id of ids) {
    if (redis) {
      const window = cfg.webhookSecret ? 20 : 4;
      const ok = await redis.set(`morya:seva:chk:${id}`, 1, { nx: true, ex: window });
      if (!ok) continue;
    }
    const paymentId = await paidDirect(cfg, id);
    if (paymentId) {
      await markPaid(id, paymentId);
      return { id, paymentId };
    }
  }
  return null;
}
