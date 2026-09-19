import { readFile } from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { DARSHAN_PASS_COOKIE, darshanConfig, hasDarshanPass } from '@/lib/darshan';
import { findOriginal } from '@/lib/darshan-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The full-resolution photo. This is the paywall — not the blur on the page.
 * No valid pass, no bytes.
 */
export async function GET(req: NextRequest) {
  const cfg = darshanConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  if (!hasDarshanPass(req.cookies.get(DARSHAN_PASS_COOKIE)?.value, cfg)) {
    return NextResponse.json({ error: 'locked' }, { status: 403, headers: NO_STORE });
  }

  const original = await findOriginal();
  if (!original) {
    return NextResponse.json({ error: 'no_image' }, { status: 404, headers: NO_STORE });
  }

  const bytes = await readFile(original.file);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': original.contentType,
      'Content-Length': String(bytes.byteLength),
      // Private: a shared CDN must never hold a paid image for the next visitor.
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="mandal-darshan.jpg"',
    },
  });
}
