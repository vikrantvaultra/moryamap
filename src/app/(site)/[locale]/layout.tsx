import type { Metadata, Viewport } from 'next';
import { Mukta } from 'next/font/google';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import Logo from '@/components/Logo';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import '@/app/globals.css';

// Mukta covers Devanagari + Latin in one family — no font swap between locales.
const mukta = Mukta({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mukta',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: '#7c2d12',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { default: t('title'), template: '%s · Morya Map' },
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('common');
  const tf = await getTranslations('footer');
  const home = locale === 'en' ? '/' : `/${locale}`;

  return (
    <html lang={locale} className={mukta.variable}>
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-40 border-b border-amber-900/10 bg-cream/90 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
              <Link href={home} className="flex items-center gap-2.5">
                <Logo />
                <span className="flex flex-col leading-none">
                  <span className="text-[17px] font-bold tracking-tight text-maroon">
                    {t('appName')}
                  </span>
                  <span className="text-[11px] font-medium text-ink-soft">{t('tagline')}</span>
                </span>
              </Link>
              <LocaleSwitcher current={locale} />
            </div>
            <div className="garland" />
          </header>

          <main className="flex flex-1 flex-col">{children}</main>

          <footer className="border-t border-amber-900/10 bg-cream-deep">
            <div className="mx-auto w-full max-w-3xl space-y-1.5 px-4 py-6 text-xs text-ink-soft">
              <p className="font-semibold text-maroon">
                {t('appName')} · {t('festivalDates')}
              </p>
              <p>{tf('honesty')}</p>
              <p>{tf('madeWith')}</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
