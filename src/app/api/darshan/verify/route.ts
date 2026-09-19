import { NextRequest, NextResponse } from 'next/server';
import { darshanConfig, markPaid, readPending, setDarshanPass } from '@/lib/darshan';
import { verifyCheckoutSignature } from '@/lib/seva';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Razorpay Checkout success handler → verify the signature, unlock the photo. */
export async function POST(req: NextRequest) {
  const cfg = darshanConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;
  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: NO_STORE });
  }

  // The order must have been created on this device, by *this* flow — a ₹21
  // seva order id lives in a different cookie and will not be found here.
  if (
    !readPending(req, cfg).includes(orderId) ||
    !verifyCheckoutSignature(orderId, paymentId, signature, cfg.keySecret)
  ) {
    return NextResponse.json({ error: 'unverified' }, { status: 400, headers: NO_STORE });
  }

  await markPaid(orderId, paymentId).catch((err) => console.error(err));
  const res = NextResponse.json({ paid: true }, { headers: NO_STORE });
  setDarshanPass(res, paymentId, cfg);
  return res;
}
