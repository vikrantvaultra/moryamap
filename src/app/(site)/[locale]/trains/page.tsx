import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHeader, { Notice, YearBadge } from '@/components/PageHeader';
import ShareBar from '@/components/ShareBar';
import Sources, { Cite, citedSources } from '@/components/Sources';
import ToolsNav from '@/components/ToolsNav';
import { CURRENT_YEAR, trains } from '@/lib/festival-data';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { localePath } from '@/lib/site';

// Hardcoded data from src/data/trains.json — rebuilt on deploy.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'trains' });
  return shareMetadata({
    locale,
    path: '/trains',
    title: t('metaTitle'),
    description: t('subtitle'),
    image: '/api/og/page/trains',
    imageAlt: 'Night trains during Ganeshotsav in Mumbai',
  });
}

export default async function TrainsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trains');
  const tc = await getTranslations('common');
  const tsrc = await getTranslations('sources');
  const ts = await getTranslations('share');

  const cited = citedSources(trains.sources, [
    ...trains.specials.map((x) => x.sourceId),
    ...trains.extendedHours.map((x) => x.sourceId),
    ...trains.lastTrains.map((x) => x.sourceId),
    ...trains.advisories.map((x) => x.sourceId),
  ]);

  // Group specials by operator, keeping source order.
  const groups: { operator: string; items: typeof trains.specials }[] = [];
  for (const s of trains.specials) {
    const g = groups.find((x) => x.operator === s.operator);
    if (g) g.items.push(s);
    else groups.push({ operator: s.operator, items: [s] });
  }
  // Current-year info first, older reference info after.
  const extended = [...trains.extendedHours].sort((a, b) => b.year - a.year);

  const yearLabel = (year: number) => tsrc('lastYear', { year });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/')}
        backLabel={tc('backToMap')}
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="mt-4">
        <ToolsNav locale={locale} current="trains" />
      </div>

      <div className="mt-5">
        <Notice>
          <span aria-hidden className="mr-1.5">
            ⚠️
          </span>
          {t('confirm')}
        </Notice>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-maroon">
          <span aria-hidden className="mr-1.5">
            🌙
          </span>
          {t('specialsTitle')}
        </h2>
        <div className="mt-2">
          {trains.announced2026 ? (
            <Notice tone="info">{t('announced')}</Notice>
          ) : (
            <Notice>{t('notAnnounced')}</Notice>
          )}
        </div>
        {groups.length === 0 ? (
          <p className="card mt-3 p-4 text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          groups.map((g) => (
            <div key={g.operator} className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                {g.operator}
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {g.items.map((s) => (
                  <li key={s.id} className="card p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-bold text-ink">
                        {s.from} → {s.to}
                      </span>
                      <YearBadge year={s.year} label={yearLabel(s.year)} />
                    </div>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-3 text-sm">
                      <div>
                        <dt className="text-xs text-ink-soft">{t('departs')}</dt>
                        <dd className="font-bold tabular-nums text-maroon">{s.departs}</dd>
                      </div>
                      {s.arrives && (
                        <div>
                          <dt className="text-xs text-ink-soft">{t('arrives')}</dt>
                          <dd className="font-bold tabular-nums">{s.arrives}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {t('night', { night: s.night })}
                      {s.stopsAt && (
                        <>
                          {' '}
                          · {t('stops')}: {s.stopsAt}
                        </>
                      )}
                      <Cite index={cited.indexOf(s.sourceId)} id={s.sourceId} />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-maroon">
          <span aria-hidden className="mr-1.5">
            🚇
          </span>
          {t('extendedTitle')}
        </h2>
        {extended.length === 0 ? (
          <p className="card mt-3 p-4 text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {extended.map((x) => (
              <li key={x.id} className="card p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold text-ink">{x.operator}</span>
                  <YearBadge year={x.year} label={yearLabel(x.year)} />
                </div>
                <p className="text-xs font-semibold text-ink-soft">{x.dates}</p>
                <p className="mt-1 text-sm leading-snug text-ink">
                  {x.details}
                  <Cite index={cited.indexOf(x.sourceId)} id={x.sourceId} />
                </p>
                {x.year < CURRENT_YEAR && (
                  <p className="mt-1 text-xs text-band-amber">
                    {tsrc('lastYearWarn', { year: x.year })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-maroon">
          <span aria-hidden className="mr-1.5">
            🕛
          </span>
          {t('lastTrainsTitle')}
        </h2>
        {trains.lastTrains.length === 0 ? (
          <p className="card mt-3 p-4 text-sm text-ink-soft">{t('lastTrainsNone')}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {trains.lastTrains.map((x) => (
              <li key={x.id} className="card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">{x.station}</span>
                  <YearBadge year={x.year} label={yearLabel(x.year)} />
                </div>
                <p className="text-sm text-ink">
                  {x.line} · {x.direction} ·{' '}
                  <span className="font-bold tabular-nums">{x.departs}</span>
                  <Cite index={cited.indexOf(x.sourceId)} id={x.sourceId} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-maroon">
          <span aria-hidden className="mr-1.5">
            📢
          </span>
          {t('advisoriesTitle')}
        </h2>
        {trains.advisories.length === 0 ? (
          <p className="card mt-3 p-4 text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {trains.advisories.map((x) => (
              <li key={x.id} className="card p-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {x.stations.map((st) => (
                    <span
                      key={st}
                      className="rounded-full bg-cream-deep px-2 py-0.5 text-[11px] font-semibold text-maroon"
                    >
                      {st}
                    </span>
                  ))}
                  <YearBadge year={x.year} label={yearLabel(x.year)} />
                </div>
                <p className="mt-1.5 text-sm leading-snug text-ink">
                  {x.text}
                  <Cite index={cited.indexOf(x.sourceId)} id={x.sourceId} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="card mt-8 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, '/trains')}
          text={ts('trainsText')}
          labels={{
            whatsapp: ts('whatsapp'),
            share: ts('share'),
            copy: ts('copy'),
            copied: ts('copied'),
          }}
        />
      </div>

      <Sources sources={cited.list} retrievedAt={trains.retrievedAt} locale={locale} />
    </div>
  );
}
