import { getMandalBySlug } from '@/lib/queries';
import { OG_SIZE, renderImage } from '@/lib/og';
import { MandalCard } from '@/lib/og-cards';

// The card embeds a time-stamped estimate, so the CDN keeps it 5 minutes.
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mandal = await getMandalBySlug(slug);
  if (!mandal) return new Response('Not found', { status: 404 });
  return renderImage(<MandalCard mandal={mandal} now={new Date()} />, OG_SIZE, 300);
}
