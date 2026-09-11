import { NextResponse } from 'next/server';
import { buildPublicSnapshot, getSnapshotState } from '@/lib/snapshot';

// This handler reads Upstash, not Postgres. It runs per-request but the CDN
// caches the response via s-maxage=60, so origin sees ~1 req/min. (The
// "never force-dynamic" rule is about public PAGES; an API endpoint cached
// at the CDN with explicit Cache-Control is the intended pattern here.)
export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function GET() {
  try {
    const state = await getSnapshotState();
    return NextResponse.json(buildPublicSnapshot(state), {
      headers: {
        ...CORS,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[snapshot] failed:', err);
    return NextResponse.json(
      { error: 'snapshot_unavailable' },
      { status: 503, headers: { ...CORS, 'Cache-Control': 'no-store' } },
    );
  }
}
