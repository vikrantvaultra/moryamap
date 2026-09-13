import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { marked } from 'marked';
import ShareBar from '@/components/ShareBar';
import WaitFigure from '@/components/WaitFigure';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { landmarkName, mandalName, pinLabelKey, queueLabel } from '@/lib/names';
import { estimateForQueue, getAllMandalSlugs, getMandalBySlug } from '@/lib/queries';
import { circuitsContaining, l10n } from '@/lib/routes';
import { localePath } from '@/lib/site';

// ISR: the CDN absorbs festival-evening spikes; origin sees ~1 req/min/page.
// Never force-dynamic on public pages.
export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllMandalSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const mandal = await getMandalBySlug(slug);
  if (!mandal) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  const title = `${mandalName(mandal, locale)} — ${mandal.area}`;
  return shareMetadata({
    locale,
    path: `/m/${slug}`,
    title,
    description: t('description'),
    image: `/api/og/m/${slug}`,
    imageAlt: `${mandal.name}, ${mandal.area}: darshan queue and wait estimate`,
  });
}

const TIER_STYLE: Record<string, string> = {
  s: 'bg-maroon text-amber-100',
  a: 'bg-flame text-white',
  b: 'bg-marigold text-maroon-deep',
  c: 'bg-cream-deep text-ink-soft',
};

export default async function MandalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const mandal = await getMandalBySlug(slug);
  if (!mandal) notFound();

  const t = await getTranslations('mandal');
  const tt = await getTranslations('tier');
  const tc = await getTranslations('common');
  const now = new Date();
  const home = localePath(locale, '/');
  const localName = mandalName(mandal, locale);
  const th = await getTranslations('home');
  const ts = await getTranslations('share');
  const tr = await getTranslations('routes');
  const tn = await getTranslations('nav');
  const ttr = await getTranslations('trains');
  const circuits = circuitsContaining(mandal.slug);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <Link href={home} className="text-sm font-medium text-flame hover:text-maroon">
        ← {tc('backToMap')}
      </Link>

      <header className="mt-3">
        <h1 className="text-3xl font-bold leading-tight text-maroon">{localName}</h1>
        {localName !== mandal.name && (
          <p className="text-sm font-medium text-ink-soft">{mandal.name}</p>
        )}
        {mandal.aliases.length > 0 && (
          <p className="mt-0.5 text-sm italic text-ink-soft">{mandal.aliases.join(' · ')}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cream-deep px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
            {mandal.area}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLE[mandal.tier]}`}
          >
            {tt(mandal.tier)}
          </span>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          {t('queuesTitle')}
        </h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {mandal.queues.map((q) => {
            const est = estimateForQueue(q, now);
            const hasPin = q.entryLat != null && q.entryLng != null;
            return (
              <article key={q.id} className="card p-4">
                <h3 className="text-base font-bold text-ink">{queueLabel(q, locale)}</h3>
                {locale !== 'en' && q.labelMr && (
                  <p className="text-xs text-ink-soft">{q.label}</p>
                )}
                <div className="mt-3">
                  <WaitFigure
                    est={est}
                    landmark={q.report ? landmarkName(q.report, locale) : null}
                    size="lg"
                  />
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {hasPin ? (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${q.entryLat},${q.entryLng}&travelmode=walking`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-maroon px-4 py-2.5 text-center text-sm font-semibold text-amber-50 shadow-sm transition-colors hover:bg-maroon-deep"
                    >
                      {t('directions')} ↗
                    </a>
                  ) : (
                    <p className="rounded-xl bg-cream-deep px-4 py-2.5 text-center text-xs text-ink-soft">
                      {t('noPin')}
                    </p>
                  )}
                  <Link
                    href={`${locale === 'en' ? '' : `/${locale}`}/report/${q.id}`}
                    className="rounded-xl border-2 border-flame px-4 py-2.5 text-center text-sm font-semibold text-flame transition-colors hover:bg-flame hover:text-white"
                  >
                    {t('report')}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {mandal.queues.some((q) => q.entryPoints.some((ep) => !ep.landmark.startsWith('TODO'))) && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t('holdingPoints')}
          </h2>
          <p className="mt-1 text-xs text-ink-soft">{t('holdingPointsHint')}</p>
          {mandal.queues.map((q) => {
            const eps = q.entryPoints.filter((ep) => !ep.landmark.startsWith('TODO'));
            if (eps.length === 0) return null;
            return (
              <div key={q.id} className="card mt-2 p-4">
                <h3 className="text-sm font-bold text-ink">{queueLabel(q, locale)}</h3>
                <ol className="mt-2 space-y-1.5">
                  {eps.map((ep) => (
                    <li key={ep.id} className="flex items-center gap-2.5 text-sm text-ink">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cream-deep text-xs font-bold text-maroon">
                        {ep.sequence}
                      </span>
                      {landmarkName(ep, locale)}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </section>
      )}

      <section className="card mt-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, `/m/${mandal.slug}`)}
          text={ts('mandalText', { name: localName, area: mandal.area })}
          storyHref={`/api/story/m/${mandal.slug}`}
          labels={{
            whatsapp: ts('whatsapp'),
            share: ts('share'),
            copy: ts('copy'),
            copied: ts('copied'),
            story: ts('story'),
          }}
        />
        <p className="mt-2 text-xs text-ink-soft">{ts('previewNote')}</p>
      </section>

      <section className="mt-4 flex flex-col gap-2">
          {circuits.map((c) => (
            <Link
              key={c.id}
              href={localePath(locale, `/routes/${c.id}`)}
              className="card flex items-center gap-3 p-3.5 text-sm font-semibold text-maroon hover:shadow-md"
            >
              <span aria-hidden className="text-lg">🪔</span>
              {tr('partOf', { title: l10n(c.title, locale) })}
            </Link>
          ))}
          <Link
            href={localePath(locale, '/guide')}
            className="card flex items-center gap-3 p-3.5 text-sm font-semibold text-maroon hover:shadow-md"
          >
            <span aria-hidden className="text-lg">🙏</span>
            {tn('guide')} →
          </Link>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t('gettingThere')}
          </h2>
          {mandal.address && (
            <p className="mt-2 text-sm text-ink">
              <span className="font-semibold">{t('address')}:</span> {mandal.address}
            </p>
          )}
          {mandal.idolLat != null && mandal.idolLng != null && (
            <>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mandal.idolLat},${mandal.idolLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-semibold text-flame underline hover:text-maroon"
              >
                {mandal.pinPrecision === 'rooftop' ? '📍' : '≈'} {t('openInMaps')} ↗
              </a>
              <p className="mt-1 text-xs text-ink-soft">{th(pinLabelKey(mandal.pinPrecision))}</p>
            </>
          )}
          {mandal.nearestStation ? (
            <p className="mt-2 text-sm text-ink">
              <span className="font-semibold">{t('nearestStation')}:</span>{' '}
              {mandal.nearestStation}
            </p>
          ) : null}
          {mandal.stationWalkMinutes != null && (
            <p className="mt-1 text-sm text-ink">{t('walk', { mins: mandal.stationWalkMinutes })}</p>
          )}
          <Link
            href={localePath(locale, '/trains')}
            className="mt-3 inline-block text-sm font-semibold text-flame underline hover:text-maroon"
          >
            <span aria-hidden className="mr-1.5">🚆</span>{ttr('mandalLink')}
          </Link>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t('bestTime')}
          </h2>
          <p className="mt-2 text-sm text-ink">{t('bestTimeLine')}</p>
        </div>
      </section>

      {mandal.notes.trim() !== '' && (
        <section className="card mt-6 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{t('notes')}</h2>
          <div
            className="prose-sm mt-2 text-sm text-ink [&_a]:text-flame [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: marked.parse(mandal.notes, { async: false }) }}
          />
        </section>
      )}
    </div>
  );
}
