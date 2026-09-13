/** Site-wide URL + time helpers shared by pages, share links and OG images. */

/**
 * Absolute origin for share links and og:image URLs. Order: explicit env,
 * Vercel's production domain, the per-deployment URL, then local dev.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/** '' for English (unprefixed URLs), '/mr' or '/hi' otherwise. */
export function localePrefix(locale: string): string {
  return locale === 'en' ? '' : `/${locale}`;
}

/** Locale-prefixed path: localePath('mr', '/routes') → '/mr/routes'. */
export function localePath(locale: string, path: string): string {
  const prefix = localePrefix(locale);
  if (path === '/' || path === '') return prefix || '/';
  return `${prefix}${path}`;
}

const IST = 'Asia/Kolkata';

/** "7:40 pm" in IST — Vercel functions run in UTC, so always pass the zone. */
export function istTime(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .toLowerCase();
}

/** "Mon 14 Sep" in IST. */
export function istDay(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

/** "2026-09-14" — the IST calendar date. */
export function istDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Localized long date for a 'YYYY-MM-DD' key, e.g. "Friday, 25 September". */
export function formatDateKey(key: string, locale: string): string {
  const [y, m, d] = key.split('-').map(Number);
  // Noon UTC keeps the calendar date stable in every zone.
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, {
    timeZone: IST,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}
