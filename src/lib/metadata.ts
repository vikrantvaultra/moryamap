import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { localePath, siteUrl } from '@/lib/site';

const OG_LOCALE: Record<string, string> = { en: 'en_IN', mr: 'mr_IN', hi: 'hi_IN' };

/**
 * Metadata for a shareable page: canonical + hreflang alternates and an
 * explicit og:image under /api/og (outside the locale middleware, so
 * crawlers never hit a locale redirect on the image URL).
 */
export function shareMetadata({
  locale,
  path,
  title,
  description,
  image,
  imageAlt,
  noIndex = false,
}: {
  locale: string;
  /** Locale-less path, e.g. '/m/lalbaugcha-raja'. */
  path: string;
  title: string;
  description: string;
  /** Path under the site, e.g. '/api/og/m/lalbaugcha-raja'. */
  image: string;
  imageAlt: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteUrl()}${localePath(locale, path)}`;
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l === 'en' ? 'en-IN' : `${l}-IN`, localePath(l, path)]),
  );
  return {
    title,
    description,
    alternates: { canonical: localePath(locale, path), languages },
    openGraph: {
      type: 'website',
      siteName: 'Morya Map',
      locale: OG_LOCALE[locale] ?? 'en_IN',
      url,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Absolute URL for a locale-less path in the given locale. */
export function absoluteUrl(locale: string, path: string): string {
  return `${siteUrl()}${localePath(locale, path)}`;
}
