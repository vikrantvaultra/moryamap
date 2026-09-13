import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Link-preview and story images must stay fetchable by WhatsApp,
        // Facebook and X crawlers; the rest of /api stays out of indexes.
        allow: ['/', '/api/og/', '/api/story/'],
        disallow: ['/admin', '/api/'],
      },
    ],
  };
}
