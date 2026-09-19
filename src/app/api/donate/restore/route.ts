import { NextRequest, NextResponse } from 'next/server';
import { clientIpFrom, hashWithSalt } from '@/lib/hash';
import { getRestoreLimiter } from '@/lib/ratelimit';
import { getRedis } from '@/lib/redis';
import { deviceId, normalizeCode, redeemCode, setDeviceCookie } from '@/lib/restore';
import { sevaConfig, setPass } from '@/lib/seva';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST { code } → unlocks this browser with an admin-issued restore code.
 * The code binds to the first browser that redeems it; see lib/restore.
 */
export async function POST(req: NextRequest) {
  const cfg = sevaConfig();
  if (!cfg || !getRedis()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  const limiter = getRestoreLimiter();
  if (limiter) {
    const { success } = await limiter.limit(hashWithSalt(clientIpFrom(req.headers)));
    if (!success) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });
    }
  }

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = normalizeCode(body?.code);
  if (!code) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: NO_STORE });

  // The device cookie goes out on every answer, so a success whose response
  // is lost still finds this browser's claim when the code is entered again.
  const device = deviceId(req);
  const reply = (data: object, status = 200) => {
    const res = NextResponse.json(data, { status, headers: NO_STORE });
    setDeviceCookie(res, device);
    return res;
  };
  try {
    const result = await redeemCode(code, device);
    if (!result.ok) return reply({ error: result.error }, 400);
    const res = reply({ paid: true, paymentId: result.paymentId });
    setPass(res, result.paymentId, cfg);
    return res;
  } catch (err) {
    console.error(err);
    return reply({ error: 'error' }, 500);
  }
}
