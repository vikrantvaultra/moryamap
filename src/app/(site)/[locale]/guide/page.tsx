import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHeader, { Notice } from '@/components/PageHeader';
import ShareBar from '@/components/ShareBar';
import ToolsNav from '@/components/ToolsNav';
import { absoluteUrl, shareMetadata } from '@/lib/metadata';
import { localePath } from '@/lib/site';

// Pure editorial content — no time-dependent data.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guide' });
  return shareMetadata({
    locale,
    path: '/guide',
    title: t('metaTitle'),
    description: t('subtitle'),
    image: '/api/og/page/guide',
    imageAlt: 'First-timer guide to Ganpati darshan in Mumbai',
  });
}

const SECTION_ICONS = ['🕓', '🎒', '🏠', '👵', '🫂', '🚆'];

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('guide');
  const tc = await getTranslations('common');
  const tw = await getTranslations('wait');
  const ts = await getTranslations('share');
  const sections = t.raw('sections') as { title: string; points: string[] }[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/')}
        backLabel={tc('backToMap')}
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="mt-4">
        <ToolsNav locale={locale} current="guide" />
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-maroon">{t('linesTitle')}</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <article className="card border-l-4 border-l-band-green p-4">
            <h3 className="text-base font-bold text-ink">
              <span aria-hidden className="mr-1.5">
                👀
              </span>
              {t('mukhTitle')}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{t('mukhBody')}</p>
          </article>
          <article className="card border-l-4 border-l-band-deepred p-4">
            <h3 className="text-base font-bold text-ink">
              <span aria-hidden className="mr-1.5">
                🙏
              </span>
              {t('navasTitle')}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{t('navasBody')}</p>
          </article>
        </div>
        <div className="mt-3">
          <Notice>{t('linesTip')}</Notice>
        </div>
        <p className="mt-2 text-xs italic text-ink-soft">{tw('disclaimer')}</p>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {sections.map((s, i) => (
          <section key={s.title} className="card p-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-maroon">
              <span aria-hidden>{SECTION_ICONS[i] ?? '•'}</span>
              {s.title}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {s.points.map((p) => (
                <li key={p} className="flex gap-2 text-sm leading-snug text-ink">
                  <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-flame" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-2xl bg-maroon p-4 text-amber-50">
        <h2 className="text-base font-bold">
          <span aria-hidden className="mr-1.5">
            🆘
          </span>
          {t('emergencyTitle')}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-50/95">{t('emergencyBody')}</p>
        <a
          href="tel:112"
          className="mt-3 inline-block rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-maroon"
        >
          📞 112
        </a>
      </section>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href={localePath(locale, '/')}
          className="flex-1 rounded-xl bg-maroon px-4 py-3 text-center text-sm font-semibold text-amber-50 hover:bg-maroon-deep"
        >
          {t('ctaMap')}
        </Link>
        <Link
          href={localePath(locale, '/routes')}
          className="flex-1 rounded-xl border-2 border-maroon px-4 py-2.5 text-center text-sm font-semibold text-maroon hover:bg-maroon hover:text-amber-50"
        >
          {t('ctaRoutes')}
        </Link>
      </div>

      <div className="card mt-6 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{ts('heading')}</h2>
        <ShareBar
          url={absoluteUrl(locale, '/guide')}
          text={ts('guideText')}
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
