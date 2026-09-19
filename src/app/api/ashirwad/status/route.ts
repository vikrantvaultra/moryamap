import { NextRequest, NextResponse } from 'next/server';
import { ashirwad, ashirwadConfig, recordBlessing } from '@/lib/ashirwad';
import { findPaid } from '@/lib/seva';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Polled while a payment is outstanding: has this device offered the ₹501 yet? */
export async function GET(req: NextRequest) {
  const cfg = ashirwadConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  const pending = ashirwad.readPending(req, cfg);
  if (pending.length === 0) return NextResponse.json({ paid: false }, { headers: NO_STORE });

  try {
    const hit = await findPaid(cfg, pending);
    if (!hit) return NextResponse.json({ paid: false }, { headers: NO_STORE });
    await recordBlessing(hit.paymentId).catch((err) => console.error(err));
    const res = NextResponse.json({ paid: true }, { headers: NO_STORE });
    ashirwad.setPass(res, hit.paymentId, cfg);
    return res;
  } catch (err) {
    console.error(err);
    // Keep polling; a transient gateway error isn't a failed payment.
    return NextResponse.json({ paid: false }, { headers: NO_STORE });
  }
}
