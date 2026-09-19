import { NextRequest, NextResponse } from 'next/server';
import { ASHIRWAD_AMOUNT, ashirwad, ashirwadConfig } from '@/lib/ashirwad';
import { hasAshirwadImage } from '@/lib/ashirwad-image';
import { clientIpFrom, hashWithSalt } from '@/lib/hash';
import { getSevaLimiter } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST { method: 'qr' | 'checkout' } → a Razorpay UPI QR to scan from another
 * phone, or an order for Checkout's UPI flow on this one. The amount is not
 * taken from the request; it is always ASHIRWAD_AMOUNT.
 */
export async function POST(req: NextRequest) {
  const cfg = ashirwadConfig();
  // No artwork, no sale — even if someone calls this route directly.
  if (!cfg || !hasAshirwadImage()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => null)) as { method?: unknown } | null;
  const method = body?.method;
  if (method !== 'qr' && method !== 'checkout') {
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
      const qr = await ashirwad.createQr(cfg);
      const res = NextResponse.json(
        { id: qr.id, imageUrl: qr.image_url, amount: ASHIRWAD_AMOUNT, closeBy: qr.close_by },
        { headers: NO_STORE },
      );
      ashirwad.addPending(req, res, qr.id, cfg);
      return res;
    }
    const order = await ashirwad.createOrder(cfg);
    const res = NextResponse.json(
      {
        orderId: order.id,
        keyId: cfg.keyId,
        amountPaise: order.amount,
        beneficiary: cfg.beneficiary,
      },
      { headers: NO_STORE },
    );
    ashirwad.addPending(req, res, order.id, cfg);
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'gateway' }, { status: 502, headers: NO_STORE });
  }
}
