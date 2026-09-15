import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import HelplineList from '@/components/HelplineList';
import PageHeader, { Notice } from '@/components/PageHeader';
import PaidFeature from '@/components/PaidFeature';
import PondFinder, { type PondItem } from '@/components/PondFinder';
import ShareBar from '@/components/ShareBar';
import Sources, { Cite, citedSources } from '@/components/Sources';
import ToolsNav from '@/components/ToolsNav';
import { CURRENT_YEAR, immersion, ruleText } from '@/lib/festival-data';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { paginationLabels } from '@/lib/pagination-labels';
import { localePath } from '@/lib/site';

// Hardcoded list from src/data/immersion-sites.json.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ponds' });
  return shareMetadata({
    locale,
    path: '/visarjan/ponds',
    title: t('metaTitle'),
    description: t('subtitle'),
    image: '/api/og/page/ponds',
    imageAlt: 'Find an immersion pond near you in Mumbai',
  });
}

export default async function PondsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ponds');
  const tv = await getTranslations('visarjan');
  const tsrc = await getTranslations('sources');
  const ts = await getTranslations('share');
  const pagination = await paginationLabels();

  const cited = citedSources(immersion.sources, [
    ...immersion.sites.map((s) => s.sourceId),
    ...immersion.rules.map((r) => r.sourceId),
    ...immersion.helplines.map((h) => h.sourceId),
  ]);

  const items: PondItem[] = immersion.sites.map((s) => ({
    id: s.id,
    kind: s.kind,
    name: (locale !== 'en' && s.nameMr) || s.name,
    ward: s.ward,
    area: s.area,
    address: s.address,
    // Area-level geocodes are good enough to sort by distance, not to route to.
    lat: s.lat,
    lng: s.lng,
    routable: s.pinPrecision === 'street',
    approx: s.pinPrecision === 'area',
    search: [s.name, s.nameMr, s.ward, s.area, s.address].filter(Boolean).join(' ').toLowerCase(),
    cite: `[${cited.indexOf(s.sourceId) + 1}]`,
    citeHref: `#src-${s.sourceId}`,
  }));

  const listYears = [...new Set(immersion.sites.map((s) => s.year))];
  const oldest = listYears.length ? Math.min(...listYears) : CURRENT_YEAR;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/visarjan')}
        backLabel={tv('title')}
        title={`🪷 ${t('title')}`}
        subtitle={t('subtitle')}
      />
      <div className="mt-4">
        <ToolsNav locale={locale} current="ponds" />
      </div>

      <div className="mt-5 space-y-2">
        <Notice tone="info">
          <span aria-hidden className="mr-1.5">
            🌱
          </span>
          {t('ecoNote')}
        </Notice>
        {items.length > 0 && oldest < CURRENT_YEAR && (
          <Notice>{tsrc('lastYearWarn', { year: oldest })}</Notice>
        )}
      </div>

      <section className="mt-5">
        {items.length === 0 ? (
          <p className="card p-4 text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          <PaidFeature kind="ponds" tall>
            <PondFinder
              items={items}
              labels={{
                nearMe: t('nearMe'),
                locating: t('locating'),
                locationDenied: t('locationDenied'),
                sortedNear: t('sortedNear'),
                searchPlaceholder: t('searchPlaceholder'),
                all: t('all'),
                artificial: t('artificial'),
                natural: t('natural'),
                collection: t('collection'),
                ward: t.raw('ward'),
                distance: t.raw('distance'),
                directions: t('directions'),
                findInMaps: t('findInMaps'),
                approxPin: t('approxPin'),
                count: t.raw('count'),
                noResults: t('noResults'),
                pagination: pagination,
                onMap: t.raw('onMap'),
                showOnMap: t('showOnMap'),
                unpinnedNote: t('unpinnedNote'),
                close: t('close'),
              }}
            />
          </PaidFeature>
        )}
      </section>

      {immersion.rules.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-maroon">
            <span aria-hidden className="mr-1.5">
              📜
            </span>
            {t('rulesTitle')}
          </h2>
          <ul className="mt-3 space-y-2">
            {immersion.rules.map((r) => (
              <li key={r.id} className="card p-3.5 text-sm leading-snug text-ink">
                {r.year < CURRENT_YEAR && (
                  <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-band-amber">
                    {r.year}
                  </span>
                )}
                {ruleText(r, locale)}
                <Cite index={cited.indexOf(r.sourceId)} id={r.sourceId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {immersion.helplines.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-maroon">
            <span aria-hidden className="mr-1.5">
              📞
            </span>
            {tv('helplinesTitle')}
          </h2>
          <HelplineList
            helplines={immersion.helplines}
            indexOf={cited.indexOf}
            callLabel={tv('callLabel')}
            pagination={pagination}
          />
        </section>
      )}

      <div className="card mt-8 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, '/visarjan/ponds')}
          text={ts('pondsText')}
          labels={{
            whatsapp: ts('whatsapp'),
            share: ts('share'),
            copy: ts('copy'),
            copied: ts('copied'),
          }}
        />
      </div>

      <Sources sources={cited.list} retrievedAt={immersion.retrievedAt} locale={locale} />
    </div>
  );
}
