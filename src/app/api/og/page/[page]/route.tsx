import { OG_SIZE, renderImage } from '@/lib/og';
import { PAGE_CARDS, PageCard } from '@/lib/og-cards';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const spec = PAGE_CARDS[page];
  if (!spec) return new Response('Not found', { status: 404 });
  return renderImage(<PageCard spec={spec} />, OG_SIZE, 86_400);
}
