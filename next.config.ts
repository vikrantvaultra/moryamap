import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Share images read the Mukta TTFs from disk at request time; make sure
  // the serverless bundle ships them.
  outputFileTracingIncludes: {
    '/api/og/**': ['./src/assets/fonts/*.ttf'],
    '/api/story/**': ['./src/assets/fonts/*.ttf'],
  },
};

export default withNextIntl(nextConfig);
