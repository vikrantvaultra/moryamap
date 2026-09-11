import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'mr', 'hi'],
  defaultLocale: 'en',
  // English URLs stay unprefixed (/, /m/lalbaugcha-raja); mr/hi get /mr, /hi.
  localePrefix: 'as-needed',
  // English is the hard default: no Accept-Language sniffing and no
  // NEXT_LOCALE cookie redirects — `/` is ALWAYS English, and mr/hi are
  // chosen explicitly via the toggle (URL prefix carries the choice).
  localeDetection: false,
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];
