import { getMandalDirectory } from '@/lib/queries';
import { OG_SIZE, renderImage } from '@/lib/og';
import { RouteCard } from '@/lib/og-cards';
import { resolveRouteKey } from '@/lib/routes';

// Routes don't change within a festival — cache the card for a day.
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const resolved = resolveRouteKey(key, await getMandalDirectory());
  if (!resolved) return new Response('Not found', { status: 404 });
  const title = resolved.circuit?.title.en ?? 'Our pandal-hopping route';
  return renderImage(<RouteCard title={title} stops={resolved.stops} />, OG_SIZE, 86_400);
}
