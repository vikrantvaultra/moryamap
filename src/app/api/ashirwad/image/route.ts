import { NextRequest, NextResponse } from 'next/server';
import { ashirwad, ashirwadConfig } from '@/lib/ashirwad';
import { loadArtwork } from '@/lib/ashirwad-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** The full Bappa artwork. This is the paywall — not the blur on the page. */
export async function GET(req: NextRequest) {
  const cfg = ashirwadConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  if (!ashirwad.hasPass(req.cookies.get(ashirwad.passCookie)?.value, cfg)) {
    return NextResponse.json({ error: 'locked' }, { status: 403, headers: NO_STORE });
  }

  let art;
  try {
    art = await loadArtwork();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'source' }, { status: 502, headers: NO_STORE });
  }
  if (!art) {
    return NextResponse.json({ error: 'no_image' }, { status: 404, headers: NO_STORE });
  }

  const download = req.nextUrl.searchParams.has('download');
  return new NextResponse(art.bytes.slice(), {
    headers: {
      'Content-Type': art.contentType,
      'Content-Length': String(art.bytes.byteLength),
      // Private: a shared CDN must never hold a paid image for the next visitor.
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="bappa-ashirwad.jpg"`,
    },
  });
}
