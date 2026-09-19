import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Share images read the Mukta TTFs from disk at request time; make sure
  // the serverless bundle ships them.
  outputFileTracingIncludes: {
    '/api/og/**': ['./src/assets/fonts/*.ttf'],
    '/api/story/**': ['./src/assets/fonts/*.ttf'],
    // The paid darshan photo is read from disk at request time and is
    // deliberately not in /public, so ship it with the function.
    '/api/darshan/image': ['./src/assets/darshan/*'],
    // The ashirwad artwork is read from disk at request time, and every page
    // that links to /ashirwad first checks it is there — so ship it with all
    // of them. /ashirwad also checks for the teaser and an optional chant.
    '/**': ['./src/assets/ashirwad/bappa.jpg'],
    '/ashirwad': ['./public/ashirwad/preview.jpg', './public/ashirwad/morya.m4a'],
  },
};

export default withNextIntl(nextConfig);
