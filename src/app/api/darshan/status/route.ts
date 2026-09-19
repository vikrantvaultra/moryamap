import { NextRequest, NextResponse } from 'next/server';
import { darshanConfig, findPaid, readPending, setDarshanPass } from '@/lib/darshan';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Polled while the QR is on screen: has this device paid for the photo yet? */
export async function GET(req: NextRequest) {
  const cfg = darshanConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  const pending = readPending(req, cfg);
  if (pending.length === 0) return NextResponse.json({ paid: false }, { headers: NO_STORE });

  try {
    const hit = await findPaid(cfg, pending);
    if (!hit) return NextResponse.json({ paid: false }, { headers: NO_STORE });
    const res = NextResponse.json({ paid: true }, { headers: NO_STORE });
    setDarshanPass(res, hit.paymentId, cfg);
    return res;
  } catch (err) {
    console.error(err);
    // Keep polling; a transient gateway error isn't a failed payment.
    return NextResponse.json({ paid: false }, { headers: NO_STORE });
  }
}
