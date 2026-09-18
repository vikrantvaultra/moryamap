import type { NextRequest, NextResponse } from 'next/server';
import {
  type SevaConfig,
  findPaid,
  markPaid,
  razorpay,
  readToken,
  sevaConfig,
  signToken,
} from '@/lib/seva';

/**
 * The paid darshan photo: one full-resolution mandal image, unlocked by a
 * one-time ₹500 payment.
 *
 * Deliberately separate from the ₹21 seva pass (@/lib/seva): its own price,
 * its own cookies, its own API routes, its own page outside the locale tree.
 * Neither unlock grants the other — the pass is minted only from an order id
 * that this flow's own pending cookie remembers.
 *
 * Unlike the seva gate, this one is a real lock, not an overlay. The page is
 * dynamic, the full image never sits in /public, and /api/darshan/image
 * verifies the signed cookie server-side before it streams a single byte.
 * The blurred preview is a separate, genuinely destroyed image — not the
 * original under a CSS filter.
 */

/** The price of the photo, in rupees. */
export const DARSHAN_AMOUNT = 500;

/** Read server-side only; unlike the seva pass there is no reason to expose it. */
export const DARSHAN_PASS_COOKIE = 'morya_darshan';
const PENDING_COOKIE = 'morya_darshan_pending';
const PENDING_PATH = '/api/darshan';

/** A bought photo stays bought — a year, not just until the festival ends. */
const PASS_MAX_AGE = 60 * 60 * 24 * 365;
const PENDING_MAX_AGE = 30 * 60;
const MAX_PENDING = 6;
export const QR_TTL_SECONDS = 15 * 60;

const secure = process.env.NODE_ENV === 'production';

/** Null when Razorpay isn't configured — the page then says so instead of taking money. */
export function darshanConfig(): SevaConfig | null {
  return sevaConfig();
}

export function isDarshanAmount(value: unknown): value is number {
  return value === DARSHAN_AMOUNT;
}

// --- The pass ---------------------------------------------------------------

/** Unlocks the photo on this device for a year. */
export function setDarshanPass(res: NextResponse, paymentRef: string, cfg: SevaConfig): void {
  const issued = Math.floor(Date.now() / 1000);
  res.cookies.set(DARSHAN_PASS_COOKIE, signToken(`${paymentRef}.${issued}`, cfg.keySecret), {
    path: '/',
    maxAge: PASS_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure,
  });
  res.cookies.set(PENDING_COOKIE, '', { path: PENDING_PATH, maxAge: 0 });
}

/**
 * True when the cookie carries an intact signature from our own key. This is
 * the only thing standing between a visitor and the full-resolution file, so
 * it is checked on the server every time the image is requested.
 */
export function hasDarshanPass(token: string | undefined, cfg: SevaConfig): boolean {
  return readToken(token, cfg.keySecret) !== null;
}

// --- Pending orders ---------------------------------------------------------

/**
 * QR codes / orders created by this device, newest first. Status checks only
 * look at these, so a paid id shared by someone else unlocks nothing — and a
 * ₹21 seva order id, which lives in a different cookie, is never in here.
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

// --- Razorpay ---------------------------------------------------------------

interface RazorpayQr {
  id: string;
  image_url: string;
  payment_amount: number;
  status: 'active' | 'closed';
  close_by: number;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  status: 'created' | 'attempted' | 'paid';
}

/** Single-use, fixed-amount UPI QR that closes after QR_TTL_SECONDS. */
export function createDarshanQr(cfg: SevaConfig): Promise<RazorpayQr> {
  return razorpay<RazorpayQr>(cfg, '/payments/qr_codes', {
    type: 'upi_qr',
    name: 'Mandal darshan photo',
    usage: 'single_use',
    fixed_amount: true,
    payment_amount: DARSHAN_AMOUNT * 100,
    description: 'Full-resolution mandal photo'.slice(0, 100),
    close_by: Math.floor(Date.now() / 1000) + QR_TTL_SECONDS,
    notes: { source: 'moryamap', purpose: 'darshan-photo', rupees: String(DARSHAN_AMOUNT) },
  });
}

export function createDarshanOrder(cfg: SevaConfig): Promise<RazorpayOrder> {
  return razorpay<RazorpayOrder>(cfg, '/orders', {
    amount: DARSHAN_AMOUNT * 100,
    currency: 'INR',
    receipt: `darshan-${Date.now()}`,
    notes: { source: 'moryamap', purpose: 'darshan-photo', rupees: String(DARSHAN_AMOUNT) },
  });
}

/** Payment marks and the paid-check are shared with seva; ids are unique per order. */
export { findPaid, markPaid };
