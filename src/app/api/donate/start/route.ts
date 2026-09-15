import { NextRequest, NextResponse } from 'next/server';
import { clientIpFrom, hashWithSalt } from '@/lib/hash';
import { getSevaLimiter } from '@/lib/ratelimit';
import { addPending, createOrder, createQr, isSevaAmount, sevaConfig } from '@/lib/seva';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST { amount, method: 'qr' | 'checkout' } → a Razorpay UPI QR code to scan
 * from another phone, or an order for Checkout's UPI-app flow on this phone.
 * Either id is remembered in this device's pending cookie.
 */
export async function POST(req: NextRequest) {
  const cfg = sevaConfig();
  if (!cfg) return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });

  const body = (await req.json().catch(() => null)) as { amount?: unknown; method?: unknown } | null;
  const amount = body?.amount;
  const method = body?.method;
  if (!isSevaAmount(amount) || (method !== 'qr' && method !== 'checkout')) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: NO_STORE });
  }

  const limiter = getSevaLimiter();
  if (limiter) {
    const { success } = await limiter.limit(hashWithSalt(clientIpFrom(req.headers)));
    if (!success) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });
    }
  }

  try {
    if (method === 'qr') {
      const qr = await createQr(cfg, amount);
      const res = NextResponse.json(
        { id: qr.id, imageUrl: qr.image_url, amount, closeBy: qr.close_by },
        { headers: NO_STORE },
      );
      addPending(req, res, qr.id, cfg);
      return res;
    }
    const order = await createOrder(cfg, amount);
    const res = NextResponse.json(
      { orderId: order.id, keyId: cfg.keyId, amountPaise: order.amount, beneficiary: cfg.beneficiary },
      { headers: NO_STORE },
    );
    addPending(req, res, order.id, cfg);
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'gateway' }, { status: 502, headers: NO_STORE });
  }
}
