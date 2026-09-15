import type { Metadata, Viewport } from 'next';
import { Mukta } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import Logo from '@/components/Logo';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import SevaGate, { type SevaLabels } from '@/components/SevaGate';
import { TOOLS } from '@/components/ToolsNav';
import { DEFAULT_SEVA_AMOUNT, SEVA_AMOUNTS, sevaConfig } from '@/lib/seva';
import { localePath, siteUrl } from '@/lib/site';
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
    metadataBase: new URL(siteUrl()),
    title: { default: t('title'), template: '%s · Morya Map' },
    description: t('description'),
    applicationName: 'Morya Map',
    formatDetection: { telephone: false },
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
  const tn = await getTranslations('nav');
  const home = localePath(locale, '/');
  const seva = await sevaLabels();

  return (
    <html lang={locale} className={mukta.variable}>
      <body className="font-sans antialiased">
        <div id="site-shell" className="flex min-h-dvh flex-col">
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
              <nav aria-label={tn('title')} className="mb-4">
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {TOOLS.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={localePath(locale, item.path)}
                        className="flex items-center gap-1.5 text-[13px] font-semibold text-maroon hover:text-flame"
                      >
                        <span aria-hidden>{item.icon}</span>
                        {tn(item.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <p className="font-semibold text-maroon">
                {t('appName')} · {t('festivalDates')}
              </p>
              <p>{tf('honesty')}</p>
              <p>{tf('madeWith')}</p>
            </div>
          </footer>
        </div>
        {seva && (
          <SevaGate labels={seva} amounts={SEVA_AMOUNTS} defaultAmount={DEFAULT_SEVA_AMOUNT} />
        )}
        <Analytics />
      </body>
    </html>
  );
}

/** Popup copy, or null when the gate isn't configured (it then never shows). */
async function sevaLabels(): Promise<SevaLabels | null> {
  const cfg = sevaConfig();
  if (!cfg) return null;
  const t = await getTranslations('seva');
  const { beneficiary } = cfg;
  const raw = (key: string) => t.raw(key) as string;
  return {
    eyebrow: raw('eyebrow'),
    title: raw('title'),
    body: t('body', { beneficiary }),
    blessing: raw('blessing'),
    chooseAmount: raw('chooseAmount'),
    tiers: t.raw('tiers') as string[],
    payOnPhone: raw('payOnPhone'),
    processing: raw('processing'),
    scanTitle: raw('scanTitle'),
    scanOnOtherPhone: raw('scanOnOtherPhone'),
    apps: raw('apps'),
    loadingQr: raw('loadingQr'),
    waiting: raw('waiting'),
    expired: raw('expired'),
    newQr: raw('newQr'),
    error: raw('error'),
    rateLimited: raw('rateLimited'),
    retry: raw('retry'),
    unlockNote: raw('unlockNote'),
    secured: raw('secured'),
    emergency: raw('emergency'),
    successTitle: raw('successTitle'),
    successBody: t('successBody', { beneficiary }),
    paymentRef: raw('paymentRef'),
    enter: raw('enter'),
  };
}
