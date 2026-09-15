import { NextRequest, NextResponse } from 'next/server';
import { markPaid, sevaConfig, verifyWebhookSignature } from '@/lib/seva';

export const dynamic = 'force-dynamic';

interface WebhookEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id?: string | null; status: string } };
    qr_code?: { entity: { id: string } };
  };
}

/**
 * Razorpay webhook (events: qr_code.credited, payment.captured). Records the
 * payment in Redis so status polls answer without calling Razorpay.
 */
export async function POST(req: NextRequest) {
  const cfg = sevaConfig();
  if (!cfg?.webhookSecret) return new NextResponse('not configured', { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!verifyWebhookSignature(raw, signature, cfg.webhookSecret)) {
    return new NextResponse('bad signature', { status: 400 });
  }

  const { event, payload } = JSON.parse(raw) as WebhookEvent;
  const payment = payload.payment?.entity;
  if (event === 'qr_code.credited' && payload.qr_code && payment) {
    await markPaid(payload.qr_code.entity.id, payment.id);
  } else if (event === 'payment.captured' && payment?.order_id) {
    await markPaid(payment.order_id, payment.id);
  }
  return NextResponse.json({ ok: true });
}
