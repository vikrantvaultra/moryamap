import { NextRequest, NextResponse } from 'next/server';
import { ashirwad, ashirwadConfig, recordBlessing } from '@/lib/ashirwad';
import { markPaid, verifyCheckoutSignature } from '@/lib/seva';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Razorpay Checkout success handler → verify the signature, open the ashirwad. */
export async function POST(req: NextRequest) {
  const cfg = ashirwadConfig();
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

  // The order must have been created on this device by *this* flow; the
  // scoped pending cookie is what keeps a paid ₹21 order id out of here.
  if (
    !ashirwad.readPending(req, cfg).includes(orderId) ||
    !verifyCheckoutSignature(orderId, paymentId, signature, cfg.keySecret)
  ) {
    return NextResponse.json({ error: 'unverified' }, { status: 400, headers: NO_STORE });
  }

  await markPaid(orderId, paymentId).catch((err) => console.error(err));
  await recordBlessing(paymentId).catch((err) => console.error(err));
  const res = NextResponse.json({ paid: true }, { headers: NO_STORE });
  ashirwad.setPass(res, paymentId, cfg);
  return res;
}
