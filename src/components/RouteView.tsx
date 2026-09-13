import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import RouteMapShell from '@/components/RouteMapShell';
import ShareBar from '@/components/ShareBar';
import { Notice } from '@/components/PageHeader';
import { formatRangeParts } from '@/components/WaitFigure';
import { absoluteUrl } from '@/lib/metadata';
import { mandalName, pinLabelKey, queueLabel } from '@/lib/names';
import { estimateForQueue } from '@/lib/queries';
import {
  kmLabel,
  legDirectionsUrl,
  legKm,
  routeDirectionsChunks,
  startDirectionsUrl,
  type PinnedMandal,
} from '@/lib/routes';
import { localePath } from '@/lib/site';

const BAND_DOT = {
  green: 'bg-band-green',
  amber: 'bg-band-amber',
  red: 'bg-band-red',
  deepred: 'bg-band-deepred',
} as const;

/** Stop-by-stop route body shared by curated circuits and custom plans. */
export default async function RouteView({
  locale,
  stops,
  sharePath,
  shareTitle,
  imageKey,
}: {
  locale: string;
  stops: PinnedMandal[];
  /** Locale-less path of this route page. */
  sharePath: string;
  shareTitle: string;
  /** Circuit id or "1-2-7" for the story image. */
  imageKey: string;
}) {
  const t = await getTranslations('routes');
  const tw = await getTranslations('wait');
  const th = await getTranslations('home');
  const ts = await getTranslations('share');
  const now = new Date();
  const legs = legKm(stops);
  const total = legs.reduce((a, b) => a + b, 0);
  const chunks = routeDirectionsChunks(stops);
  const first = stops[0];
  const last = stops[stops.length - 1];

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm font-semibold text-ink">
        {t('summary', { count: stops.length, km: kmLabel(total) })}
      </p>

      <RouteMapShell
        points={stops.map((s, i) => ({
          lat: s.idolLat,
          lng: s.idolLng,
          label: String(i + 1),
          name: mandalName(s, locale),
          approx: s.pinPrecision === 'area',
        }))}
      />

      <div className="card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, sharePath)}
          text={ts('routeText', { title: shareTitle, count: stops.length })}
          storyHref={`/api/story/route/${imageKey}`}
          labels={{
            whatsapp: ts('whatsapp'),
            share: ts('share'),
            copy: ts('copy'),
            copied: ts('copied'),
            story: ts('story'),
          }}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a
          href={startDirectionsUrl(first)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-maroon px-4 py-2.5 text-center text-sm font-semibold text-amber-50 shadow-sm hover:bg-maroon-deep"
        >
          {t('startHere')}
        </a>
        {chunks.map((c) => (
          <a
            key={c.from}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border-2 border-maroon px-4 py-2 text-center text-sm font-semibold text-maroon hover:bg-maroon hover:text-amber-50"
          >
            {t('fullRoute', { from: c.from, to: c.to })}
          </a>
        ))}
      </div>

      <div className="space-y-1.5 text-xs text-ink-soft">
        {first.nearestStation && (
          <p>
            <span aria-hidden className="mr-1.5">
              🚉
            </span>
            {t('startNear', { station: first.nearestStation })}
          </p>
        )}
        {last.nearestStation && last !== first && (
          <p>
            <span aria-hidden className="mr-1.5">
              🚉
            </span>
            {t('endNear', { station: last.nearestStation })}
          </p>
        )}
      </div>

      <Notice>
        {t('waitsNote')} {tw('disclaimer')}
      </Notice>

      <ol className="space-y-0">
        {stops.map((m, i) => (
          <li key={m.id}>
            <article className="card p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-maroon text-sm font-bold text-amber-50">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {t('stop', { n: i + 1 })} · {m.area}
                  </p>
                  <h3 className="text-base font-bold leading-tight text-ink">
                    {mandalName(m, locale)}
                  </h3>
                  <div className="mt-1.5 space-y-1">
                    {m.queues.map((q) => {
                      const est = estimateForQueue(q, now);
                      const parts = formatRangeParts(est);
                      return (
                        <div key={q.id} className="flex flex-wrap items-center gap-x-1.5 text-sm">
                          <span className="text-xs font-medium text-ink-soft">
                            {queueLabel(q, locale)}:
                          </span>
                          <span
                            className={`size-2.5 shrink-0 rounded-full ${BAND_DOT[est.band]}`}
                            aria-hidden
                          />
                          <span className="font-bold tabular-nums">
                            {tw(parts.key, { low: parts.low, high: parts.high })}
                          </span>
                          <span className="text-xs text-ink-soft">
                            ·{' '}
                            {est.provenance === 'reported' && est.reportedAt
                              ? tw('reportedShort', {
                                  mins: Math.max(
                                    1,
                                    Math.round((now.getTime() - est.reportedAt.getTime()) / 60_000),
                                  ),
                                })
                              : tw('estimateShort')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {m.pinPrecision !== 'rooftop' && (
                    <p className="mt-1.5 text-[11px] font-medium text-band-amber">
                      ≈ {th(pinLabelKey(m.pinPrecision))}
                    </p>
                  )}
                  <Link
                    href={localePath(locale, `/m/${m.slug}`)}
                    className="mt-2 inline-block text-sm font-semibold text-flame underline hover:text-maroon"
                  >
                    {t('details')} →
                  </Link>
                </div>
              </div>
            </article>
            {i < legs.length && (
              <div className="ml-7 flex items-center gap-3 border-l-2 border-dashed border-marigold py-2.5 pl-5">
                <div className="min-w-0">
                  <p className="text-xs text-ink-soft">{t('legKm', { km: kmLabel(legs[i]) })}</p>
                  <a
                    href={legDirectionsUrl(m, stops[i + 1])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-maroon underline hover:text-flame"
                  >
                    {t('walkLeg', { n: i + 2 })}
                  </a>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      {/* Mandal pins are never queue starts; non-rooftop stops say so above. */}
      <Notice tone="info">{t('approxPins')}</Notice>
      <p className="text-xs italic text-ink-soft">{t('orderNote')}</p>
    </div>
  );
}
