import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHeader from '@/components/PageHeader';
import PaidFeature from '@/components/PaidFeature';
import RouteView from '@/components/RouteView';
import { shareMetadata } from '@/lib/metadata';
import { mandalName } from '@/lib/names';
import { getMandalDirectory } from '@/lib/queries';
import { parseStopIds, resolveIds } from '@/lib/routes';
import { localePath } from '@/lib/site';

// Custom routes live entirely in the URL (/r/1-5-7): nothing is stored.
// Rendered on first request, then cached like every other public page.
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams(): { stops: string }[] {
  return [];
}

async function load(param: string) {
  const ids = parseStopIds(param);
  if (!ids) return null;
  return resolveIds(ids, await getMandalDirectory());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; stops: string }>;
}): Promise<Metadata> {
  const { locale, stops: param } = await params;
  const stops = await load(param);
  if (!stops) return {};
  const t = await getTranslations({ locale, namespace: 'routes' });
  return shareMetadata({
    locale,
    path: `/r/${param}`,
    title: t('customTitle'),
    description: stops.map((m) => mandalName(m, locale)).join(' → '),
    image: `/api/og/route/${param}`,
    imageAlt: 'A pandal-hopping route planned on Morya Map',
    noIndex: true,
  });
}

export default async function CustomRoutePage({
  params,
}: {
  params: Promise<{ locale: string; stops: string }>;
}) {
  const { locale, stops: param } = await params;
  setRequestLocale(locale);
  const stops = await load(param);
  if (!stops) notFound();
  const t = await getTranslations('routes');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/routes')}
        backLabel={t('allRoutes')}
        eyebrow={
          <span className="text-xs font-bold uppercase tracking-wide text-flame">
            <span aria-hidden className="mr-1.5">
              🪔
            </span>
            {t('title')}
          </span>
        }
        title={t('customTitle')}
        subtitle={t('customSubtitle')}
      >
        <Link
          href={`${localePath(locale, '/plan')}#${param}`}
          className="mt-3 inline-block rounded-full border border-flame px-3 py-1 text-sm font-semibold text-flame hover:bg-flame hover:text-white"
        >
          <span aria-hidden className="mr-1.5">
            ✏️
          </span>
          {t('edit')}
        </Link>
      </PageHeader>
      <PaidFeature kind="routes" tall>
        <RouteView
          locale={locale}
          stops={stops}
          sharePath={`/r/${param}`}
          shareTitle={t('customTitle')}
          imageKey={param}
        />
      </PaidFeature>
    </div>
  );
}
