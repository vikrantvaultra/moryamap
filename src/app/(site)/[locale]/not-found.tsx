import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { localePath } from '@/lib/site';

// Branded 404 inside the site layout. Matters because shared WhatsApp links
// can outlive a page (e.g. a mandal removed from the directory).
export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations('notFound');
  const tn = await getTranslations('nav');
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-5xl" aria-hidden>
        🙏
      </p>
      <h1 className="mt-3 text-2xl font-bold text-maroon">{t('title')}</h1>
      <p className="mt-2 text-[15px] leading-snug text-ink-soft">{t('body')}</p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
        <Link
          href={localePath(locale, '/')}
          className="flex-1 rounded-xl bg-maroon px-4 py-3 text-sm font-semibold text-amber-50 hover:bg-maroon-deep"
        >
          <span aria-hidden className="mr-1.5">
            📍
          </span>
          {tn('map')}
        </Link>
        <Link
          href={localePath(locale, '/routes')}
          className="flex-1 rounded-xl border-2 border-maroon px-4 py-2.5 text-sm font-semibold text-maroon hover:bg-maroon hover:text-amber-50"
        >
          <span aria-hidden className="mr-1.5">
            🪔
          </span>
          {tn('routes')}
        </Link>
      </div>
    </div>
  );
}
