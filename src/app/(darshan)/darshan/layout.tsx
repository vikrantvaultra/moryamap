import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';

/**
 * Standalone: its own <html>, outside the (site)/[locale] tree and outside
 * next-intl. No header, no tools nav, no footer, no link back into Morya Map —
 * this page is only itself.
 */
export const metadata: Metadata = {
  title: 'Mandal Darshan — the photo',
  description: 'One full-resolution mandal photograph.',
};

export const viewport: Viewport = {
  themeColor: '#5c1f0a',
};

export default function DarshanLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
