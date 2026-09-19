import type { Metadata, Viewport } from 'next';
import { Mukta } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { hasAshirwadPreview, PREVIEW_PATH } from '@/lib/ashirwad-image';
import { siteUrl } from '@/lib/site';
import '@/app/globals.css';

// Same family as the site: the blessing is half Devanagari.
const mukta = Mukta({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mukta',
  display: 'swap',
});

/**
 * Standalone, like /darshan: its own <html>, outside the locale tree and
 * next-intl, with no seva sheet popping over it. The copy is bilingual
 * (मराठी + English) in the page itself.
 */
export async function generateMetadata(): Promise<Metadata> {
  const title = 'गणपती बाप्पाचा आशीर्वाद · Receive Bappa’s ashirwad';
  const description =
    'Before Bappa goes home on Anant Chaturdashi, stand before Him once more — wherever you are.';
  const images = hasAshirwadPreview() ? [{ url: PREVIEW_PATH, alt: 'Bappa, waiting to bless you' }] : [];
  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    openGraph: { title, description, url: '/ashirwad', type: 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
  };
}

export const viewport: Viewport = {
  themeColor: '#2a0d04',
};

export default function AshirwadLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mr" className={mukta.variable}>
      <body className="ashirwad-sanctum min-h-dvh font-sans text-amber-50 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
