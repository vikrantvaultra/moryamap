/**
 * Channel tagging for share links. No database: links carry standard UTM
 * parameters, so Vercel Web Analytics (or any analytics tool) can break
 * visits down by channel, and share clicks are sent as analytics events.
 */
import { track } from '@vercel/analytics';

export const SHARE_CHANNELS = ['whatsapp', 'native', 'copy', 'story'] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/** Append utm_source/utm_medium to an absolute or relative URL. */
export function withUtm(url: string, source: ShareChannel): string {
  const [base, hash] = url.split('#');
  const [path, query = ''] = base.split('?');
  const params = new URLSearchParams(query);
  params.set('utm_source', source);
  params.set('utm_medium', 'share');
  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

/** Fire-and-forget share event. Never throws, never blocks the share. */
export function trackShare(channel: ShareChannel, path: string): void {
  try {
    track('share', { channel, path });
  } catch {
    // analytics must never break the page
  }
}
