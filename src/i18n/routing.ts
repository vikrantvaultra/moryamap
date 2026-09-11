import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'mr', 'hi'],
  defaultLocale: 'en',
  // English URLs stay unprefixed (/, /m/lalbaugcha-raja); mr/hi get /mr, /hi.
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
