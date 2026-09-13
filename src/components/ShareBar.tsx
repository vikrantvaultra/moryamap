'use client';

import { useEffect, useState } from 'react';
import { trackShare, withUtm } from '@/lib/refs';

export interface ShareLabels {
  whatsapp: string;
  share: string;
  copy: string;
  copied: string;
  story?: string;
}

/**
 * WhatsApp-first share row. The WhatsApp button is a plain link (works
 * without JS); the OS share sheet and copy button appear after hydration
 * when the browser supports them. Every link carries UTM tags so analytics
 * can show which channel actually spreads.
 */
export default function ShareBar({
  url,
  text,
  labels,
  storyHref,
  compact = false,
}: {
  /** Absolute canonical URL, without UTM tags. */
  url: string;
  /** Localized message placed before the link. */
  text: string;
  labels: ShareLabels;
  /** Optional 1080×1920 story image for Instagram/WhatsApp status. */
  storyHref?: string;
  compact?: boolean;
}) {
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const path = new URL(url).pathname;

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text}\n${withUtm(url, 'whatsapp')}`)}`;

  const nativeShare = async () => {
    try {
      await navigator.share({ text, url: withUtm(url, 'native') });
      trackShare('native', path);
    } catch {
      // user dismissed the sheet
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(withUtm(url, 'copy'));
      trackShare('copy', path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing sensible to do
    }
  };

  const btn =
    'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors';

  return (
    // Phones: WhatsApp gets its own full-width row, the rest share a 2-column
    // grid so no label wraps; wider screens put everything on one row.
    <div className={`grid grid-cols-2 gap-2 sm:flex sm:flex-wrap ${compact ? '' : 'mt-3'}`}>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare('whatsapp', path)}
        className={`${btn} col-span-2 bg-[#128c3e] text-white hover:bg-[#0e7333] sm:flex-1`}
      >
        <WhatsAppIcon />
        {labels.whatsapp}
      </a>
      {canNativeShare && (
        <button
          type="button"
          onClick={nativeShare}
          className={`${btn} bg-cream-deep text-maroon hover:bg-amber-100`}
        >
          {labels.share}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className={`${btn} bg-cream-deep text-maroon hover:bg-amber-100 ${canNativeShare ? '' : 'col-span-2 sm:col-span-1'}`}
        aria-live="polite"
      >
        {copied ? labels.copied : labels.copy}
      </button>
      {storyHref && labels.story && (
        <a
          href={storyHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare('story', path)}
          className={`${btn} col-span-2 border-2 border-flame text-flame hover:bg-flame hover:text-white`}
        >
          {labels.story}
        </a>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.79.97-.14.16-.29.19-.54.06a6.8 6.8 0 0 1-2-1.23 7.5 7.5 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}
