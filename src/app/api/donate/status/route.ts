import { NextRequest, NextResponse } from 'next/server';
import { findPaid, readPending, sevaConfig, setPass } from '@/lib/seva';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Polled by the gate while a QR is on screen: has this device paid yet? */
export async function GET(req: NextRequest) {
  const cfg = sevaConfig();
  if (!cfg) return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });

  const pending = readPending(req, cfg);
  if (pending.length === 0) return NextResponse.json({ paid: false }, { headers: NO_STORE });

  try {
    const hit = await findPaid(cfg, pending);
    if (!hit) return NextResponse.json({ paid: false }, { headers: NO_STORE });
    const res = NextResponse.json({ paid: true, paymentId: hit.paymentId }, { headers: NO_STORE });
    setPass(res, hit.paymentId, cfg);
    return res;
  } catch (err) {
    console.error(err);
    // Keep polling; a transient gateway error isn't a failed payment.
    return NextResponse.json({ paid: false }, { headers: NO_STORE });
  }
}
