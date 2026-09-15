'use client';

import { useEffect, useState } from 'react';
import { SEVA_OPEN_EVENT, SEVA_PAID_EVENT, hasPass } from '@/lib/seva-client';

export interface LockedLabels {
  title: string;
  cta: string;
  hint: string;
}

/**
 * Blurs a paid feature behind an unlock card until this device holds a pass.
 * Pages are ISR, so the server can't read the cookie: everything renders
 * locked and opens on hydration for devices that have already paid.
 * `tall` clips long content (routes, planner) to a preview.
 */
export default function Locked({
  labels,
  tall = false,
  children,
}: {
  labels: LockedLabels;
  tall?: boolean;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (hasPass()) setUnlocked(true);
    const open = () => setUnlocked(hasPass());
    window.addEventListener(SEVA_PAID_EVENT, open);
    return () => window.removeEventListener(SEVA_PAID_EVENT, open);
  }, []);

  if (unlocked) return <>{children}</>;

  return (
    <div className={`relative ${tall ? 'max-h-[26rem] overflow-hidden rounded-2xl' : ''}`}>
      <div aria-hidden inert className="pointer-events-none select-none blur-[6px]">
        {children}
      </div>
      <div
        className={`absolute inset-0 flex justify-center bg-cream/40 px-3 ${
          tall ? 'items-start bg-gradient-to-b from-cream/30 to-cream pt-10' : 'items-center'
        }`}
      >
        <div className="flex max-w-xs flex-col items-center gap-2 rounded-2xl bg-cream/95 px-4 py-3.5 text-center shadow-lg ring-1 ring-amber-900/10">
          <p className="text-sm font-bold text-maroon">
            <span aria-hidden className="mr-1">
              🔒
            </span>
            {labels.title}
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(SEVA_OPEN_EVENT))}
            className="seva-shine relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-flame to-marigold px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-flame/30 active:scale-[0.98]"
          >
            {labels.cta}
          </button>
          <p className="text-[11px] text-ink-soft">{labels.hint}</p>
        </div>
      </div>
    </div>
  );
}
