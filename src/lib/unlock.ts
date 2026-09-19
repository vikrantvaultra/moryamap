import type { NextRequest, NextResponse } from 'next/server';
import { type SevaConfig, razorpay, readToken, signToken } from '@/lib/seva';

/**
 * A one-time, fixed-price unlock: a Razorpay UPI QR or Checkout order, a
 * pending-orders cookie, and a signed pass cookie. Same machinery as the
 * darshan photo, parameterised so each paid page gets its own price, cookies
 * and API prefix.
 *
 * Every token a flow signs carries its own `scope`. All flows sign with the
 * same Razorpay-derived key, so without the scope a ₹21 seva pass — whose
 * cookie is readable by page script — could be pasted into another flow's
 * cookie and validate. Scoped, it can't: a token only reads back in the flow
 * that minted it. The same goes for pending-order lists, which is what stops
 * a paid ₹21 order id from being replayed here as proof of a ₹501 payment.
 */

export interface UnlockOptions {
  /** Short, unique, stable: part of every signed token. Changing it voids existing passes. */
  scope: string;
  /** Rupees. The only amount this flow will ever charge. */
  amount: number;
  passCookie: string;
  pendingCookie: string;
  /** The API prefix; the pending cookie is only sent there. */
  apiPath: string;
  /** Seconds the pass lasts. */
  passMaxAge: number;
  /** Shown on the Razorpay QR and in the dashboard. */
  qrName: string;
  description: string;
}

const PENDING_MAX_AGE = 30 * 60;
const MAX_PENDING = 6;
export const QR_TTL_SECONDS = 15 * 60;

const secure = process.env.NODE_ENV === 'production';

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

export function createUnlock(opts: UnlockOptions) {
  const passPrefix = `${opts.scope}:`;
  const pendingPrefix = `${opts.scope}-pending:`;

  /** Unlocks this flow on this device for opts.passMaxAge. */
  function setPass(res: NextResponse, paymentRef: string, cfg: SevaConfig): void {
    const issued = Math.floor(Date.now() / 1000);
    res.cookies.set(
      opts.passCookie,
      signToken(`${passPrefix}${paymentRef}.${issued}`, cfg.keySecret),
      { path: '/', maxAge: opts.passMaxAge, httpOnly: true, sameSite: 'lax', secure },
    );
    res.cookies.set(opts.pendingCookie, '', { path: opts.apiPath, maxAge: 0 });
  }

  /** Intact signature from our key AND minted by this flow. Checked server-side on every request. */
  function hasPass(token: string | undefined, cfg: SevaConfig): boolean {
    return readToken(token, cfg.keySecret)?.startsWith(passPrefix) ?? false;
  }

  /** The payment reference inside a valid pass — shown back as the receipt. */
  function passRef(token: string | undefined, cfg: SevaConfig): string | null {
    const value = readToken(token, cfg.keySecret);
    if (!value?.startsWith(passPrefix)) return null;
    const body = value.slice(passPrefix.length);
    return body.slice(0, body.lastIndexOf('.')) || null;
  }

  /** QR codes / orders this flow created on this device, newest first. */
  function readPending(req: NextRequest, cfg: SevaConfig): string[] {
    const value = readToken(req.cookies.get(opts.pendingCookie)?.value, cfg.keySecret);
    if (!value?.startsWith(pendingPrefix)) return [];
    return value.slice(pendingPrefix.length).split(',').filter(Boolean);
  }

  function addPending(req: NextRequest, res: NextResponse, id: string, cfg: SevaConfig): void {
    const ids = [id, ...readPending(req, cfg).filter((x) => x !== id)].slice(0, MAX_PENDING);
    res.cookies.set(opts.pendingCookie, signToken(`${pendingPrefix}${ids.join(',')}`, cfg.keySecret), {
      path: opts.apiPath,
      maxAge: PENDING_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }

  const notes = { source: 'moryamap', purpose: opts.scope, rupees: String(opts.amount) };

  /** Single-use, fixed-amount UPI QR that closes after QR_TTL_SECONDS. */
  function createQr(cfg: SevaConfig): Promise<RazorpayQr> {
    return razorpay<RazorpayQr>(cfg, '/payments/qr_codes', {
      type: 'upi_qr',
      name: opts.qrName,
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: opts.amount * 100,
      description: opts.description.slice(0, 100),
      close_by: Math.floor(Date.now() / 1000) + QR_TTL_SECONDS,
      notes,
    });
  }

  function createOrder(cfg: SevaConfig): Promise<RazorpayOrder> {
    return razorpay<RazorpayOrder>(cfg, '/orders', {
      amount: opts.amount * 100,
      currency: 'INR',
      receipt: `${opts.scope}-${Date.now()}`,
      notes,
    });
  }

  return {
    amount: opts.amount,
    passCookie: opts.passCookie,
    setPass,
    hasPass,
    passRef,
    readPending,
    addPending,
    createQr,
    createOrder,
  };
}

export type Unlock = ReturnType<typeof createUnlock>;
