import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { siteUrl } from '@/lib/site';

/**
 * Shared look for link-preview (1200×630) and story (1080×1920) images.
 *
 * Images are English-only on purpose: Satori (next/og) has no complex-script
 * shaping, so Devanagari matras and conjuncts render visibly broken. The
 * localized WhatsApp message text carries Marathi/Hindi instead.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const STORY_SIZE = { width: 1080, height: 1920 } as const;

export const C = {
  cream: '#fdf9f2',
  creamDeep: '#f8efe0',
  ink: '#2d1b10',
  inkSoft: '#6b5544',
  marigold: '#f59e0b',
  flame: '#ea580c',
  maroon: '#7c2d12',
  maroonDeep: '#5c1f0a',
  band: { green: '#15803d', amber: '#b45309', red: '#dc2626', deepred: '#7f1d1d' },
} as const;

let fontsPromise: Promise<
  { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[]
> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all(
    (['Regular', 'Bold'] as const).map(async (w) => ({
      name: 'Mukta',
      data: await readFile(join(process.cwd(), 'src/assets/fonts', `Mukta-${w}.ttf`)),
      weight: (w === 'Bold' ? 700 : 400) as 400 | 700,
      style: 'normal' as const,
    })),
  );
  return fontsPromise;
}

export function displayHost(): string {
  return siteUrl().replace(/^https?:\/\//, '');
}

/** Latin-only fallback for a name that may be Devanagari-only. */
export function latin(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/[ऀ-ॿ]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function Garland({ height = 12 }: { height?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height,
        backgroundImage: `linear-gradient(90deg, ${C.maroon} 0%, ${C.flame} 25%, ${C.marigold} 50%, ${C.flame} 75%, ${C.maroon} 100%)`,
      }}
    />
  );
}

export function LogoMark({ size = 64 }: { size?: number }) {
  const petals = [
    [44, 32],
    [40.5, 40.5],
    [32, 44],
    [23.5, 40.5],
    [20, 32],
    [23.5, 23.5],
    [32, 20],
    [40.5, 23.5],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill={C.maroon} />
      {petals.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="7" fill={C.marigold} />
      ))}
      <circle cx="32" cy="32" r="7.5" fill="#fde68a" />
    </svg>
  );
}

export function Brand({ size = 1 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 * size }}>
      <LogoMark size={60 * size} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontSize: 36 * size, fontWeight: 700, color: C.maroon }}>Morya Map</span>
        <span style={{ fontSize: 22 * size, color: C.inkSoft, marginTop: 4 }}>
          Ganeshotsav 2026 · Mumbai
        </span>
      </div>
    </div>
  );
}

export function Pill({
  children,
  bg,
  color = '#fff',
  size = 22,
}: {
  children: ReactNode;
  bg: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      style={{
        display: 'flex',
        backgroundColor: bg,
        color,
        fontSize: size,
        fontWeight: 700,
        padding: `${size * 0.2}px ${size * 0.7}px`,
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}
    >
      {children}
    </span>
  );
}

export async function renderImage(
  node: ReactNode,
  size: { width: number; height: number },
  cacheSeconds: number,
): Promise<Response> {
  const res = new ImageResponse(node as React.ReactElement, {
    ...size,
    fonts: await loadFonts(),
  });
  res.headers.set(
    'Cache-Control',
    `public, max-age=${Math.min(cacheSeconds, 300)}, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`,
  );
  return res;
}

/** 1200×630 frame: garland, brand row, body, footer strip. */
export function OgFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: C.cream,
        fontFamily: 'Mukta',
        color: C.ink,
      }}
    >
      <Garland />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '36px 56px 0' }}>
        <Brand />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginTop: 24 }}>
          {children}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: C.maroon,
          color: '#fef3c7',
          padding: '16px 56px',
          fontSize: 24,
        }}
      >
        <span style={{ display: 'flex' }}>
          {footer ?? 'Queue starts · honest waits · how to get there'}
        </span>
        <span style={{ display: 'flex', fontWeight: 700 }}>{displayHost()}</span>
      </div>
    </div>
  );
}
