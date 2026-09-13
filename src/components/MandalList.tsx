'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface ListQueue {
  label: string;
  band: 'green' | 'amber' | 'red' | 'deepred';
  range: string;
  provenance: string;
  reported: boolean;
}

export interface ListItem {
  slug: string;
  name: string;
  area: string;
  address: string | null;
  /** Lowercased haystack of every name variant + area + address, for search. */
  search: string;
  queues: ListQueue[];
}

export interface ListLabels {
  searchPlaceholder: string;
  noResults: string;
  pageOf: string;
}

const BAND_DOT: Record<ListQueue['band'], string> = {
  green: 'bg-band-green',
  amber: 'bg-band-amber',
  red: 'bg-band-red',
  deepred: 'bg-band-deepred',
};

const PAGE_SIZE = 10;

/**
 * Search + pagination are client-side over server-rendered (ISR) data:
 * instant, no extra requests, and the first page still SSRs for no-JS.
 * Never sorted or filterable by wait — area/popularity order only.
 */
export default function MandalList({
  items,
  labels,
  prefix,
}: {
  items: ListItem[];
  labels: ListLabels;
  prefix: string;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.search.includes(q));
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Area headers within the current page.
  const grouped: { area: string; items: ListItem[] }[] = [];
  for (const item of slice) {
    const last = grouped[grouped.length - 1];
    if (last && last.area === item.area) last.items.push(item);
    else grouped.push({ area: item.area, items: [item] });
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchPlaceholder}
        className="w-full rounded-xl border border-amber-900/15 bg-white px-4 py-2.5 text-base text-ink shadow-sm outline-none placeholder:text-ink-soft/60 focus:border-flame"
      />

      {filtered.length === 0 ? (
        <p className="card mt-4 p-4 text-sm text-ink-soft">{labels.noResults}</p>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.map((g, gi) => (
            <div key={`${g.area}-${gi}`}>
              <h3 className="text-base font-bold text-maroon">{g.area}</h3>
              <ul className="mt-1.5 space-y-2">
                {g.items.map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={`${prefix}/m/${m.slug}`}
                      className="card block p-3.5 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-bold text-ink">{m.name}</span>
                        <span className="shrink-0 text-flame" aria-hidden>
                          →
                        </span>
                      </div>
                      {m.address && (
                        <p className="mt-0.5 text-xs leading-snug text-ink-soft">{m.address}</p>
                      )}
                      <div className="mt-1.5 space-y-1">
                        {m.queues.map((q, qi) => (
                          <div key={qi} className="flex flex-wrap items-center gap-x-1.5 text-sm">
                            <span className="text-xs font-medium text-ink-soft">{q.label}:</span>
                            <span
                              className={`size-2.5 shrink-0 rounded-full ${BAND_DOT[q.band]}`}
                              aria-hidden
                            />
                            <span className="font-bold tabular-nums text-ink">{q.range}</span>
                            <span
                              className={`text-xs ${
                                q.reported ? 'font-medium text-band-green' : 'text-ink-soft'
                              }`}
                            >
                              · {q.provenance}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Pagination">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current <= 1}
            className="grid size-10 place-items-center rounded-full bg-cream-deep text-lg font-bold text-maroon disabled:opacity-30"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-ink-soft">
            {labels.pageOf.replace('{page}', String(current)).replace('{total}', String(totalPages))}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= totalPages}
            className="grid size-10 place-items-center rounded-full bg-cream-deep text-lg font-bold text-maroon disabled:opacity-30"
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}
