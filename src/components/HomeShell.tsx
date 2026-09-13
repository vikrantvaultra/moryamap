'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Mobile app-shell for the home screen: the map fills the viewport and a
 * floating pill toggles between it and the list. Desktop (md+) shows both
 * stacked. Before hydration both render, so the list stays reachable
 * without JS (the map needs JS anyway).
 */
export default function HomeShell({
  map,
  list,
  labels,
  callout,
}: {
  map: ReactNode;
  list: ReactNode;
  labels: { map: string; list: string };
  /** Floating link above the Map/List pill on phones (festival banner or tools). */
  callout?: { href: string; icon: string; label: string };
}) {
  const [view, setView] = useState<'map' | 'list' | null>(null);
  useEffect(() => setView('map'), []);

  const showMap = view !== 'list';
  const showList = view !== 'map';

  return (
    <div className="flex flex-1 flex-col">
      <div className={`${showMap ? 'block' : 'hidden'} md:block`}>{map}</div>
      <div className={`${showList ? 'block' : 'hidden'} md:block`}>{list}</div>

      {view && (
        <nav className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-2 px-4 md:hidden">
          {callout && view === 'map' && (
            <Link
              href={callout.href}
              className="max-w-full truncate rounded-full border border-amber-900/10 bg-white/95 px-4 py-2 text-[13px] font-semibold text-maroon shadow-lg backdrop-blur"
            >
              <span aria-hidden className="mr-1.5">
                {callout.icon}
              </span>
              {callout.label}
            </Link>
          )}
          <div className="flex rounded-full bg-maroon p-1 shadow-lg shadow-maroon/30">
            {(
              [
                ['map', labels.map],
                ['list', labels.list],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={`rounded-full px-6 py-2 text-sm font-bold transition-colors ${
                  view === key ? 'bg-amber-100 text-maroon' : 'text-amber-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
