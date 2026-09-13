import { getMandalBySlug } from '@/lib/queries';
import { STORY_SIZE, renderImage } from '@/lib/og';
import { MandalStory } from '@/lib/og-cards';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mandal = await getMandalBySlug(slug);
  if (!mandal) return new Response('Not found', { status: 404 });
  return renderImage(<MandalStory mandal={mandal} now={new Date()} />, STORY_SIZE, 300);
}
