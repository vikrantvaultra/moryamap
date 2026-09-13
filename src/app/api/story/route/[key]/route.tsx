import { getMandalDirectory } from '@/lib/queries';
import { STORY_SIZE, renderImage } from '@/lib/og';
import { RouteStory } from '@/lib/og-cards';
import { resolveRouteKey } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const resolved = resolveRouteKey(key, await getMandalDirectory());
  if (!resolved) return new Response('Not found', { status: 404 });
  const title = resolved.circuit?.title.en ?? 'Our pandal-hopping route';
  return renderImage(<RouteStory title={title} stops={resolved.stops} />, STORY_SIZE, 86_400);
}
