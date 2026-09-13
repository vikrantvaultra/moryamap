import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHeader from '@/components/PageHeader';
import ShareBar from '@/components/ShareBar';
import ToolsNav from '@/components/ToolsNav';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { mandalName } from '@/lib/names';
import { getMandalDirectory } from '@/lib/queries';
import { CIRCUITS, kmLabel, l10n, legKm, resolveCircuit } from '@/lib/routes';
import { localePath } from '@/lib/site';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'routes' });
  return shareMetadata({
    locale,
    path: '/routes',
    title: t('metaTitle'),
    description: t('subtitle'),
    image: '/api/og/page/routes',
    imageAlt: 'Pandal-hopping routes in Mumbai',
  });
}

export default async function RoutesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('routes');
  const tc = await getTranslations('common');
  const ts = await getTranslations('share');
  const directory = await getMandalDirectory();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/')}
        backLabel={tc('backToMap')}
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="mt-4">
        <ToolsNav locale={locale} current="routes" />
      </div>

      <Link
        href={localePath(locale, '/plan')}
        className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-maroon p-4 text-amber-50 shadow-sm hover:bg-maroon-deep"
      >
        <span>
          <span className="block text-base font-bold">
            <span aria-hidden className="mr-1.5">
              ✏️
            </span>
            {t('buildOwn')}
          </span>
          <span className="block text-sm text-amber-100/90">{t('buildOwnHint')}</span>
        </span>
        <span aria-hidden className="text-xl">
          →
        </span>
      </Link>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {CIRCUITS.map((c) => {
          const stops = resolveCircuit(c, directory);
          const km = legKm(stops).reduce((a, b) => a + b, 0);
          return (
            <li key={c.id} className="min-w-0">
              <Link
                href={localePath(locale, `/routes/${c.id}`)}
                className="card flex h-full flex-col p-4 transition-shadow hover:shadow-md"
              >
                <span className="text-lg font-bold leading-tight text-maroon">
                  {l10n(c.title, locale)}
                </span>
                <span className="mt-1 text-sm text-ink-soft">{l10n(c.blurb, locale)}</span>
                <ol className="mt-3 space-y-1">
                  {stops.map((m, i) => (
                    <li key={m.id} className="flex min-w-0 items-center gap-2 text-sm text-ink">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-cream-deep text-[11px] font-bold text-maroon">
                        {i + 1}
                      </span>
                      <span className="truncate">{mandalName(m, locale)}</span>
                    </li>
                  ))}
                </ol>
                <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3 text-xs font-semibold text-ink-soft">
                  <span>
                    {t('stopsCount', { count: stops.length })} · {t('totalKm', { km: kmLabel(km) })}
                  </span>
                  <span className="text-flame">{t('view')} →</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs italic text-ink-soft">{t('orderNote')}</p>

      <div className="card mt-6 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, '/routes')}
          text={ts('routesText')}
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
