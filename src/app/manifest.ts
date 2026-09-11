import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Morya Map',
    short_name: 'Morya Map',
    description: 'Ganeshotsav queues, honestly. Mumbai, 14–25 September 2026.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdf9f2',
    theme_color: '#7c2d12',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
