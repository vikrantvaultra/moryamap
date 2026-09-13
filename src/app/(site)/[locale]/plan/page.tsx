import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHeader from '@/components/PageHeader';
import RoutePlanner, { type PlannerMandal } from '@/components/RoutePlanner';
import ShareBar from '@/components/ShareBar';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { mandalName } from '@/lib/names';
import { getMandalDirectory } from '@/lib/queries';
import { isPinned } from '@/lib/routes';
import { paginationLabels } from '@/lib/pagination-labels';
import { localePath } from '@/lib/site';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'plan' });
  return shareMetadata({
    locale,
    path: '/plan',
    title: t('metaTitle'),
    description: t('subtitle'),
    image: '/api/og/page/plan',
    imageAlt: 'Plan a pandal-hopping route',
  });
}

export default async function PlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('plan');
  const tr = await getTranslations('routes');
  const ts = await getTranslations('share');
  const directory = await getMandalDirectory();

  // Famous mandals first, then the directory's area order. Never by wait.
  const tierRank = { s: 0, a: 1, b: 2, c: 3 } as const;
  const mandals: PlannerMandal[] = directory
    .filter(isPinned)
    .map((m, i) => ({ m, i }))
    .sort((a, b) => tierRank[a.m.tier] - tierRank[b.m.tier] || a.i - b.i)
    .map(({ m }) => ({
      id: m.id,
      name: mandalName(m, locale),
      area: m.area,
      idolLat: m.idolLat,
      idolLng: m.idolLng,
      areaOnly: m.pinPrecision === 'area',
      search: [m.name, m.nameMr, m.nameHi, m.area, m.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/routes')}
        backLabel={tr('allRoutes')}
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <RoutePlanner
        mandals={mandals}
        routeBase={localePath(locale, '/r')}
        labels={{
          searchPlaceholder: t('searchPlaceholder'),
          add: t('add'),
          added: t('added'),
          remove: t('remove'),
          moveUp: t('moveUp'),
          moveDown: t('moveDown'),
          sortGeo: t('sortGeo'),
          sortGeoHint: t('sortGeoHint'),
          selected: t.raw('selected'),
          empty: t('empty'),
          create: t('create'),
          needMore: t('needMore'),
          full: t('full'),
          areaOnly: t('areaOnly'),
          noResults: t('noResults'),
          pagination: await paginationLabels(),
        }}
      />
      <div className="card mt-6 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, '/plan')}
          text={ts('plannerText')}
          labels={{
            whatsapp: ts('whatsapp'),
            share: ts('share'),
            copy: ts('copy'),
            copied: ts('copied'),
          }}
        />
      </div>
    </div>
  );
}
