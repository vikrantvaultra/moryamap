import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import HelplineList from '@/components/HelplineList';
import PagedList from '@/components/Pagination';
import PageHeader, { Notice, YearBadge } from '@/components/PageHeader';
import RouteMapShell from '@/components/RouteMapShell';
import ShareBar from '@/components/ShareBar';
import Sources, { Cite, citedSources } from '@/components/Sources';
import ToolsNav from '@/components/ToolsNav';
import { CURRENT_YEAR, dayStatus, immersion, visarjan, type Closure } from '@/lib/festival-data';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { paginationLabels } from '@/lib/pagination-labels';
import { formatDateKey, localePath } from '@/lib/site';

// Hardcoded data; revalidate hourly so "today / tomorrow" labels stay right.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'visarjan' });
  return shareMetadata({
    locale,
    path: '/visarjan',
    title: t('metaTitle'),
    description: t('subtitle'),
    image: '/api/og/page/visarjan',
    imageAlt: 'Visarjan day in Mumbai: dates, closures, bridges, helplines',
  });
}

const DAY_GROUPS = [
  'anant_chaturdashi',
  'all_immersion_days',
  'during_processions',
  'festival_days',
] as const;

export default async function VisarjanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('visarjan');
  const tc = await getTranslations('common');
  const tf = await getTranslations('festival');
  const tsrc = await getTranslations('sources');
  const ts = await getTranslations('share');
  const pagination = await paginationLabels();
  const now = new Date();

  const { procession } = visarjan;
  const dates = [...immersion.dates].sort((a, b) => a.date.localeCompare(b.date));

  // Citations are numbered per page across both datasets.
  const allSources = [
    ...visarjan.sources,
    ...immersion.sources.filter((s) => !visarjan.sources.some((v) => v.id === s.id)),
  ];
  const cited = citedSources(allSources, [
    ...dates.map((d) => d.sourceId),
    ...procession.sourceIds,
    ...procession.facts.map((f) => f.sourceId),
    ...visarjan.closures.map((c) => c.sourceId),
    ...visarjan.bridges.map((b) => b.sourceId),
    ...visarjan.helplines.map((h) => h.sourceId),
    ...visarjan.channels.map((c) => c.sourceId),
  ]);

  const closureYears = [...new Set(visarjan.closures.map((c) => c.year))];
  const oldestClosureYear = Math.min(...closureYears);
  const groupOf = (c: Closure) =>
    DAY_GROUPS.find((g) => c.appliesOn.includes(g)) ?? 'festival_days';
  const closureGroups = DAY_GROUPS.map((g) => ({
    key: g,
    items: visarjan.closures.filter((c) => groupOf(c) === g),
  })).filter((g) => g.items.length > 0);

  const pinned = procession.checkpoints.filter((c) => c.lat != null && c.lng != null);
  const cpName = (c: (typeof procession.checkpoints)[number]) =>
    (locale !== 'en' && c.nameMr) || c.name;

  const liveChannels = visarjan.channels.filter((c) => c.id.startsWith('lalbaugcharaja'));
  const otherChannels = visarjan.channels.filter((c) => !c.id.startsWith('lalbaugcharaja'));
  const bridgeListYear = Math.min(...visarjan.bridges.map((b) => b.year));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/')}
        backLabel={tc('backToMap')}
        title={`🌊 ${t('title')}`}
        subtitle={t('subtitle')}
      />
      <div className="mt-4">
        <ToolsNav locale={locale} current="visarjan" />
      </div>

      {/* Dates */}
      <section className="mt-6">
        <h2 className="text-lg font-bold text-maroon">{t('datesTitle')}</h2>
        {dates.length === 0 ? (
          <p className="card mt-2 p-4 text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {dates.map((d) => {
              const status = dayStatus(d.date, now);
              return (
                <li
                  key={d.key}
                  className={`card flex items-center justify-between gap-3 p-3.5 ${
                    status === 'today' ? 'ring-2 ring-flame' : status === 'past' ? 'opacity-60' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-ink">{tf(d.key)}</span>
                    <span className="block text-sm text-ink-soft">
                      {formatDateKey(d.date, locale)}
                      <Cite index={cited.indexOf(d.sourceId)} id={d.sourceId} />
                    </span>
                  </span>
                  {status !== 'upcoming' && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        status === 'today'
                          ? 'bg-flame text-white'
                          : status === 'tomorrow'
                            ? 'bg-amber-100 text-maroon'
                            : 'bg-cream-deep text-ink-soft'
                      }`}
                    >
                      {status === 'today'
                        ? tf('today')
                        : status === 'tomorrow'
                          ? tf('tomorrowLabel')
                          : tf('done')}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href={localePath(locale, '/visarjan/ponds')}
          className="rounded-2xl bg-maroon p-4 text-sm font-bold text-amber-50 shadow-sm hover:bg-maroon-deep"
        >
          <span aria-hidden className="mr-1.5">
            🪷
          </span>
          {t('pondsCta')}
        </Link>
        <Link
          href={localePath(locale, '/trains')}
          className="rounded-2xl border-2 border-maroon p-4 text-sm font-bold text-maroon hover:bg-maroon hover:text-amber-50"
        >
          <span aria-hidden className="mr-1.5">
            🚆
          </span>
          {t('trainsCta')}
        </Link>
      </div>

      {/* Procession */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-maroon">{t('processionTitle')}</h2>
        <p className="mt-1 text-sm leading-snug text-ink">{t('processionIntro')}</p>
        <div className="mt-2">
          <Notice>{t('noLive')}</Notice>
        </div>

        {liveChannels.length > 0 && (
          <div className="card mt-3 p-4">
            <h3 className="text-sm font-bold text-ink">
              <span aria-hidden className="mr-1.5">
                📺
              </span>
              {t('liveTitle')}
            </h3>
            <p className="text-xs text-ink-soft">{t('liveBody')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {liveChannels.map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-cream-deep px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-amber-100"
                >
                  {c.name} ↗
                </a>
              ))}
            </div>
          </div>
        )}

        {pinned.length > 1 && (
          <div className="mt-3">
            <RouteMapShell
              points={pinned.map((c) => ({
                lat: c.lat!,
                lng: c.lng!,
                label: String(c.sequence),
                name: cpName(c),
              }))}
            />
            <p className="mt-1.5 text-xs text-ink-soft">{t('mapNote')}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t('routeTitle')}
          </h3>
          <YearBadge year={procession.year} label={tsrc('lastYear', { year: procession.year })} />
        </div>
        <ol className="mt-2 border-l-2 border-dashed border-marigold pl-4">
          {procession.checkpoints.map((c) => (
            <li key={c.id} className="relative pb-3 last:pb-0">
              <span className="absolute -left-[27px] top-0 grid size-5 place-items-center rounded-full bg-maroon text-[10px] font-bold text-amber-50">
                {c.sequence}
              </span>
              <span className="text-sm font-semibold text-ink">{cpName(c)}</span>
              {c.lat == null && (
                <span className="ml-1.5 text-[11px] text-ink-soft">({t('checkpointNoPin')})</span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-ink-soft">
          {t('routeNote', { year: procession.year })}
          {procession.sourceIds.map((id) => (
            <Cite key={id} index={cited.indexOf(id)} id={id} />
          ))}
        </p>

        {procession.facts.length > 0 && (
          <div className="card mt-4 p-4">
            <h3 className="text-sm font-bold text-ink">{t('factsTitle')}</h3>
            <ul className="mt-2 space-y-2">
              {procession.facts.map((f) => (
                <li key={f.text} className="text-sm leading-snug text-ink">
                  <span className="mr-1.5 rounded bg-cream-deep px-1.5 py-0.5 text-[11px] font-bold text-maroon">
                    {f.year}
                  </span>
                  {f.text}
                  <Cite index={cited.indexOf(f.sourceId)} id={f.sourceId} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Closures */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-maroon">
          <span aria-hidden className="mr-1.5">
            🚧
          </span>
          {t('closuresTitle')}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t('closuresIntro')}</p>
        {visarjan.closures.length === 0 ? (
          <p className="card mt-2 p-4 text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          <>
            {oldestClosureYear < CURRENT_YEAR && (
              <div className="mt-2">
                <Notice>{tsrc('lastYearWarn', { year: oldestClosureYear })}</Notice>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {closureGroups.map((g, gi) => (
                <details key={g.key} open={gi === 0} className="card group overflow-hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <span className="text-base font-bold text-ink">
                      {t(`days.${g.key}`)}{' '}
                      <span className="text-sm font-medium text-ink-soft">({g.items.length})</span>
                    </span>
                    <span
                      aria-hidden
                      className="text-flame transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <ul className="divide-y divide-amber-900/10 border-t border-amber-900/10">
                    {g.items.map((c) => (
                      <li key={c.id} className="p-4">
                        <p className="text-sm font-bold leading-snug text-ink">{c.road}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-band-red/10 px-2 py-0.5 text-[11px] font-bold text-band-red">
                            {c.restriction}
                          </span>
                          <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                            {c.area}
                          </span>
                          <YearBadge year={c.year} label={tsrc('lastYear', { year: c.year })} />
                        </div>
                        <p className="mt-1.5 text-sm leading-snug text-ink">
                          {c.details}
                          <Cite index={cited.indexOf(c.sourceId)} id={c.sourceId} />
                        </p>
                        {c.timeWindow && (
                          <p className="mt-1 text-xs font-semibold text-ink-soft">
                            <span aria-hidden className="mr-1.5">
                              🕒
                            </span>
                            {t('timeWindow', { window: c.timeWindow })}
                          </p>
                        )}
                        {c.appliesOn.length > 1 && (
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {t('appliesOn', {
                              days: c.appliesOn
                                .map((d) => (t.has(`days.${d}`) ? t(`days.${d}`) : d))
                                .join(', '),
                            })}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Bridges */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-maroon">
          <span aria-hidden className="mr-1.5">
            🌉
          </span>
          {t('bridgesTitle')}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t('bridgesIntro')}</p>
        {visarjan.bridges.length === 0 ? (
          <p className="card mt-2 p-4 text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-soft">
              {t('bridgesYear', { year: bridgeListYear })}
            </p>
            <PagedList className="mt-3 grid gap-2 sm:grid-cols-2" pageSize={6} labels={pagination}>
              {[...visarjan.bridges]
                .sort((a, b) => b.year - a.year)
                .map((b) => (
                  <li key={b.id} className="card p-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-ink">{b.name}</span>
                      {b.year >= CURRENT_YEAR && (
                        <span className="rounded-full bg-band-red px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          {t('closed2026')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-soft">{b.area}</p>
                    <p className="mt-1 text-[13px] leading-snug text-ink">
                      {b.advice}
                      <Cite index={cited.indexOf(b.sourceId)} id={b.sourceId} />
                    </p>
                  </li>
                ))}
            </PagedList>
          </>
        )}
      </section>

      {/* Helplines */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-maroon">
          <span aria-hidden className="mr-1.5">
            📞
          </span>
          {t('helplinesTitle')}
        </h2>
        <HelplineList
          helplines={visarjan.helplines}
          indexOf={cited.indexOf}
          callLabel={t('callLabel')}
          pagination={pagination}
        />
      </section>

      {otherChannels.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-maroon">
            <span aria-hidden className="mr-1.5">
              📣
            </span>
            {t('channelsTitle')}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {otherChannels.map((c) => (
              <li key={c.id}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full border border-amber-900/15 bg-white px-3 py-1.5 text-sm font-semibold text-maroon hover:border-flame"
                >
                  {c.name} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card mt-8 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, '/visarjan')}
          text={ts('visarjanText')}
          labels={{
            whatsapp: ts('whatsapp'),
            share: ts('share'),
            copy: ts('copy'),
            copied: ts('copied'),
          }}
        />
      </div>

      <Sources sources={cited.list} retrievedAt={visarjan.retrievedAt} locale={locale} />
    </div>
  );
}
