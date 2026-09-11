import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import MapShell from '@/components/MapShell';
import type { MapStrings } from '@/components/MapView';
import WaitChip from '@/components/WaitChip';
import { mandalName, queueLabel } from '@/lib/names';
import { estimateForQueue, getMandalDirectory, type MandalData } from '@/lib/queries';

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

  // The map is a client island with no intl provider — hand it raw templates.
  const mapStrings: MapStrings = {
    loading: tc('loading'),
    noPins: t('noPinsYet'),
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

  const byArea = new Map<string, MandalData[]>();
  for (const m of mandals) {
    byArea.set(m.area, [...(byArea.get(m.area) ?? []), m]);
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-gradient-to-b from-cream-deep to-cream">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-6">
          <h1 className="text-2xl font-bold leading-tight text-maroon">{t('title')}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t('subtitle', { count: mandals.length || 15 })}
          </p>
          <p className="mt-2 inline-block rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-maroon">
            📍 {t('mapNote')}
          </p>
        </div>
      </section>

      <MapShell strings={mapStrings} locale={locale} />

      <section className="mx-auto w-full max-w-3xl px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t('listTitle')}
          </h2>
          <LegendInline />
        </div>

        {dbDown && (
          <p className="card mt-3 p-4 text-sm text-ink-soft">{t('noPinsYet')}</p>
        )}

        <div className="mt-3 space-y-5">
          {[...byArea.entries()].map(([area, ms]) => (
            <div key={area}>
              <h3 className="text-base font-bold text-maroon">{area}</h3>
              <ul className="mt-1.5 space-y-2">
                {ms.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`${prefix}/m/${m.slug}`}
                      className="card block p-3.5 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-bold text-ink">
                          {mandalName(m, locale)}
                        </span>
                        <span className="shrink-0 text-flame" aria-hidden>
                          →
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {m.queues.map((q) => (
                          <div key={q.id} className="flex flex-wrap items-center gap-x-2">
                            <span className="text-xs font-medium text-ink-soft">
                              {queueLabel(q, locale)}:
                            </span>
                            <WaitChip est={estimateForQueue(q, now)} />
                          </div>
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs italic text-ink-soft">{t('sortNote')}</p>
      </section>
    </div>
  );
}

async function LegendInline() {
  const tb = await getTranslations('bands');
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {BAND_KEYS.map((b) => (
        <span key={b} className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
          <span className={`size-2 rounded-full ${BAND_DOT[b]}`} aria-hidden />
          {tb(b)}
        </span>
      ))}
    </div>
  );
}
