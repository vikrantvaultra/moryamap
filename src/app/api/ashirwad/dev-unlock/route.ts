import { NextResponse } from 'next/server';
import { DEV_PAYMENT_REF, ashirwad, ashirwadConfig, devUnlockEnabled } from '@/lib/ashirwad';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Local test mode only (see devUnlockEnabled): POST opens the darshan on this
 * device without a payment, DELETE locks it again. Anywhere else this route
 * doesn't exist — a 404, not a 403, so there is nothing to probe.
 */
function guard(): NextResponse | null {
  return devUnlockEnabled() ? null : new NextResponse(null, { status: 404, headers: NO_STORE });
}

export async function POST() {
  const blocked = guard();
  if (blocked) return blocked;
  const cfg = ashirwadConfig();
  if (!cfg) return new NextResponse(null, { status: 404, headers: NO_STORE });
  // Not recorded as a blessing: the devotee count is real payments only.
  const res = NextResponse.json({ paid: true, test: true }, { headers: NO_STORE });
  ashirwad.setPass(res, DEV_PAYMENT_REF, cfg);
  return res;
}

export async function DELETE() {
  const blocked = guard();
  if (blocked) return blocked;
  const res = NextResponse.json({ locked: true }, { headers: NO_STORE });
  res.cookies.set(ashirwad.passCookie, '', { path: '/', maxAge: 0 });
  return res;
}
