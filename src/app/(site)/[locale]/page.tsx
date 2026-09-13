import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import HomeShell from '@/components/HomeShell';
import ShareBar from '@/components/ShareBar';
import ToolsNav from '@/components/ToolsNav';
import MandalList, { type ListItem } from '@/components/MandalList';
import MapShell from '@/components/MapShell';
import type { MapStrings } from '@/components/MapView';
import { formatRangeParts } from '@/components/WaitFigure';
import { immersionMoment } from '@/lib/festival-data';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { mandalName, queueLabel } from '@/lib/names';
import { estimateForQueue, getMandalDirectory, type MandalData } from '@/lib/queries';
import { localePath } from '@/lib/site';

// ISR — the single most important decision in the build. The CDN absorbs
// festival-evening spikes; origin sees ~1 request/minute.
export const revalidate = 60;

const BAND_KEYS = ['green', 'amber', 'red', 'deepred'] as const;
const BAND_DOT: Record<(typeof BAND_KEYS)[number], string> = {
  green: 'bg-band-green',
  amber: 'bg-band-amber',
  red: 'bg-band-red',
  deepred: 'bg-band-deepred',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    ...shareMetadata({
      locale,
      path: '/',
      title: t('title'),
      description: t('description'),
      image: '/api/og/page/home',
      imageAlt: 'Morya Map: Ganpati mandal queues in Mumbai',
    }),
    // The layout's title template would append "· Morya Map" twice.
    title: { absolute: t('title') },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tw = await getTranslations('wait');
  const tb = await getTranslations('bands');
  const tm = await getTranslations('mandal');
  const tc = await getTranslations('common');
  const ts = await getTranslations('share');
  const tf = await getTranslations('festival');
  const tn = await getTranslations('nav');

  // The map is a client island with no intl provider — hand it raw templates.
  const mapStrings: MapStrings = {
    loading: tc('loading'),
    noPins: t('noPinsYet'),
    mapNote: t('mapNote'),
    approxLocation: t('approxLocation'),
    areaOnly: t('areaOnly'),
    queueStart: t('queueStart'),
    directions: tm('directions'),
    details: t('details'),
    report: tm('report'),
    disclaimer: tw('disclaimer'),
    estimateLabel: tw('estimateLabel'),
    reportedLabel: tw.raw('reportedLabel'),
    reportedJustNow: tw('reportedJustNow'),
    lineStartsAt: tw.raw('lineStartsAt'),
    hours: tw.raw('hours'),
    minutes: tw.raw('minutes'),
    minutesUpTo: tw.raw('minutesUpTo'),
    bands: {
      green: tb('green'),
      amber: tb('amber'),
      red: tb('red'),
      deepred: tb('deepred'),
    },
  };

  let mandals: MandalData[] = [];
  let dbDown = false;
  try {
    mandals = await getMandalDirectory();
  } catch {
    dbDown = true;
  }
  const now = new Date();
  const prefix = locale === 'en' ? '' : `/${locale}`;

  // Immersion-day banner (today/tomorrow, IST). Anant Chaturdashi links to
  // the full visarjan page; the household immersion days link to ponds.
  const moment = immersionMoment(now);
  const banner = moment
    ? moment.day.key === 'anant_chaturdashi' && moment.when === 'today'
      ? { href: localePath(locale, '/visarjan'), label: `🌊 ${tf('todayAnant')}` }
      : {
          href: localePath(locale, moment.when === 'today' ? '/visarjan/ponds' : '/visarjan'),
          label: `🪷 ${tf(moment.when === 'today' ? 'todayImmersion' : 'tomorrow', { name: tf(moment.day.key) })}`,
        }
    : null;
  const callout = banner ?? { href: localePath(locale, '/routes'), label: `🪔 ${tn('routes')} →` };

  // Precompute display strings server-side so the list client component
  // ships no i18n runtime. Order stays area/popularity — never wait.
  const items: ListItem[] = mandals.map((m) => ({
    slug: m.slug,
    name: mandalName(m, locale),
    area: m.area,
    address: m.address,
    search: [m.name, m.nameMr, m.nameHi, m.area, m.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    queues: m.queues.map((q) => {
      const est = estimateForQueue(q, now);
      const parts = formatRangeParts(est);
      const reported = est.provenance === 'reported';
      return {
        label: queueLabel(q, locale),
        band: est.band,
        range: tw(parts.key, { low: parts.low, high: parts.high }),
        provenance:
          reported && est.reportedAt
            ? tw('reportedShort', {
                mins: Math.max(1, Math.round((now.getTime() - est.reportedAt.getTime()) / 60_000)),
              })
            : tw('estimateShort'),
        reported,
      };
    }),
  }));

  return (
    <HomeShell
      labels={{ map: t('showMap'), list: t('showList') }}
      callout={callout}
      map={
        <div className="h-[calc(100dvh-3.75rem)] md:h-[62vh]">
          <MapShell strings={mapStrings} locale={locale} />
        </div>
      }
      list={
        <section className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5 md:pb-8">
          <h1 className="text-2xl font-bold leading-tight text-maroon">{t('title')}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t('subtitle', { count: mandals.length || 15 })}
          </p>

          {banner && (
            <Link
              href={banner.href}
              className="mt-3 block rounded-xl bg-maroon px-4 py-3 text-sm font-semibold text-amber-50 shadow-sm hover:bg-maroon-deep"
            >
              {banner.label}
            </Link>
          )}

          <div className="mt-3">
            <ToolsNav locale={locale} current="map" hideMap />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              {t('listTitle')}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {BAND_KEYS.map((b) => (
                <span
                  key={b}
                  className="flex items-center gap-1 text-[11px] font-medium text-ink-soft"
                >
                  <span className={`size-2 rounded-full ${BAND_DOT[b]}`} aria-hidden />
                  {tb(b)}
                </span>
              ))}
            </div>
          </div>

          {dbDown && <p className="card mt-3 p-4 text-sm text-ink-soft">{t('noPinsYet')}</p>}

          <div className="mt-3">
            <MandalList
              items={items}
              prefix={prefix}
              labels={{
                searchPlaceholder: t('searchPlaceholder'),
                noResults: t('noResults'),
                pageOf: t.raw('pageOf'),
              }}
            />
          </div>

          <p className="mt-5 text-xs italic text-ink-soft">{t('sortNote')}</p>

          <div className="card mt-6 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
            <ShareBar
              url={absoluteUrl(locale, '/')}
              text={ts('homeText', { count: mandals.length || 15 })}
              labels={{ whatsapp: ts('whatsapp'), share: ts('share'), copy: ts('copy'), copied: ts('copied') }}
            />
          </div>
        </section>
      }
    />
  );
}
