'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Pagination, usePaged } from './Pagination';
import { compareWards, REGIONS, type Region } from '@/lib/wards';

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
  /** The English name, shown underneath when `name` is localized. */
  originalName: string | null;
  area: string;
  /** 'D', 'F/S', 'Thane' … — null never happens in the shipped directory. */
  ward: string | null;
  wardLabel: string;
  region: Region;
  aliases: string[];
  address: string | null;
  tierLabel: string;
  tierClass: string;
  /** Short badge for how far to trust the pin, e.g. "Approx. location". */
  pinLabel: string;
  pinIcon: string;
  /** "Dadar (Western) · 8 min walk", already assembled server-side. */
  gettingThere: string | null;
  /** First line of the mandal's notes, if any. */
  note: string | null;
  /** Lowercased haystack of every name variant, alias, area, ward and address. */
  search: string;
  queues: ListQueue[];
}

export interface ListLabels {
  searchPlaceholder: string;
  noResults: string;
  pageOf: string;
  prev: string;
  next: string;
  /** "Showing {shown} of {total}" */
  showing: string;
  showAll: string;
  paginate: string;
  all: string;
  regions: Record<Region, string>;
  filterRegion: string;
  filterWard: string;
  clear: string;
}

const BAND_DOT: Record<ListQueue['band'], string> = {
  green: 'bg-band-green',
  amber: 'bg-band-amber',
  red: 'bg-band-red',
  deepred: 'bg-band-deepred',
};

const PAGE_SIZE = 25;

function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'bg-maroon text-amber-50'
          : 'bg-cream-deep text-ink-soft hover:bg-amber-900/10 hover:text-maroon'
      }`}
    >
      {children}
      {count != null && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
    </button>
  );
}

/**
 * The whole directory, browsable: free-text search plus region → ward
 * filters, everything client-side over server-rendered (ISR) data. Every
 * mandal the site knows about is reachable from here — the pagination is a
 * rendering budget, not a cap, so there's a "show all" escape hatch.
 *
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
  const [region, setRegion] = useState<Region | null>(null);
  const [ward, setWard] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Counts come from the full directory, so a chip never reads "0" for a
  // ward that does have mandals — it reads how many the search left in it.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.search.includes(q)) : items;
  }, [items, query]);

  const regionCounts = useMemo(() => {
    const c = new Map<Region, number>();
    for (const i of searched) c.set(i.region, (c.get(i.region) ?? 0) + 1);
    return c;
  }, [searched]);

  const wardCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of searched) {
      if (region && i.region !== region) continue;
      if (i.ward) c.set(i.ward, (c.get(i.ward) ?? 0) + 1);
    }
    return c;
  }, [searched, region]);

  const wards = useMemo(() => [...wardCounts.keys()].sort(compareWards), [wardCounts]);

  const filtered = useMemo(
    () =>
      searched.filter(
        (i) => (!region || i.region === region) && (!ward || i.ward === ward),
      ),
    [searched, region, ward],
  );

  const resetKey = `${query}|${region}|${ward}|${showAll}`;
  const paged = usePaged(filtered, showAll ? filtered.length || 1 : PAGE_SIZE, resetKey);
  const slice = paged.slice;

  // Ward heading, then area sub-heading, within the current page.
  const grouped: { ward: string; areas: { area: string; items: ListItem[] }[] }[] = [];
  for (const item of slice) {
    const w = item.wardLabel;
    let group = grouped[grouped.length - 1];
    if (!group || group.ward !== w) {
      group = { ward: w, areas: [] };
      grouped.push(group);
    }
    const last = group.areas[group.areas.length - 1];
    if (last && last.area === item.area) last.items.push(item);
    else group.areas.push({ area: item.area, items: [item] });
  }

  const filtersOn = region != null || ward != null || query.trim() !== '';

  return (
    <div ref={paged.topRef} className="scroll-mt-20">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchPlaceholder}
        className="w-full rounded-xl border border-amber-900/15 bg-white px-4 py-2.5 text-base text-ink shadow-sm outline-none placeholder:text-ink-soft/60 focus:border-flame"
      />

      <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1" aria-label={labels.filterRegion}>
        <Chip
          active={region == null}
          onClick={() => {
            setRegion(null);
            setWard(null);
          }}
          count={searched.length}
        >
          {labels.all}
        </Chip>
        {REGIONS.filter((r) => regionCounts.has(r)).map((r) => (
          <Chip
            key={r}
            active={region === r}
            onClick={() => {
              setRegion(region === r ? null : r);
              setWard(null);
            }}
            count={regionCounts.get(r)}
          >
            {labels.regions[r]}
          </Chip>
        ))}
      </div>

      {wards.length > 1 && (
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1" aria-label={labels.filterWard}>
          {wards.map((w) => (
            <Chip
              key={w}
              active={ward === w}
              onClick={() => setWard(ward === w ? null : w)}
              count={wardCounts.get(w)}
            >
              {searched.find((i) => i.ward === w)?.wardLabel ?? w}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft" aria-live="polite">
          {labels.showing
            .replace('{shown}', String(filtered.length))
            .replace('{total}', String(items.length))}
        </p>
        <div className="flex items-center gap-3">
          {filtersOn && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setRegion(null);
                setWard(null);
              }}
              className="text-xs font-semibold text-flame underline"
            >
              {labels.clear}
            </button>
          )}
          {filtered.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-semibold text-flame underline"
            >
              {showAll ? labels.paginate : labels.showAll}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="card mt-4 p-4 text-sm text-ink-soft">{labels.noResults}</p>
      ) : (
        <div className="mt-3 space-y-5">
          {grouped.map((g, gi) => (
            <div key={`${g.ward}-${gi}`}>
              {/* Parks under the site header (h-14 + 4px garland + border),
                  not at top-0, where it would slide behind it and vanish. */}
              <h3 className="sticky top-[61px] z-20 -mx-1 bg-cream/95 px-1 py-1.5 text-xs font-bold uppercase tracking-wide text-flame backdrop-blur">
                {g.ward}
              </h3>
              {g.areas.map((a, ai) => (
                <div key={`${a.area}-${ai}`} className="mt-2">
                  <h4 className="text-base font-bold text-maroon">{a.area}</h4>
                  <ul className="mt-1.5 space-y-2">
                    {a.items.map((m) => (
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
                          {m.originalName && (
                            <p className="text-xs font-medium text-ink-soft">{m.originalName}</p>
                          )}
                          {m.aliases.length > 0 && (
                            <p className="mt-0.5 text-xs italic leading-snug text-ink-soft">
                              {m.aliases.join(' · ')}
                            </p>
                          )}

                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.tierClass}`}
                            >
                              {m.tierLabel}
                            </span>
                            <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                              {m.wardLabel}
                            </span>
                            <span className="text-[10px] font-medium text-ink-soft">
                              <span aria-hidden>{m.pinIcon}</span> {m.pinLabel}
                            </span>
                          </div>

                          {m.address && (
                            <p className="mt-1 text-xs leading-snug text-ink-soft">{m.address}</p>
                          )}
                          {m.gettingThere && (
                            <p className="mt-0.5 text-xs leading-snug text-ink-soft">
                              <span aria-hidden>🚆</span> {m.gettingThere}
                            </p>
                          )}

                          <div className="mt-1.5 space-y-1">
                            {m.queues.map((q, qi) => (
                              <div
                                key={qi}
                                className="flex flex-wrap items-center gap-x-1.5 text-sm"
                              >
                                <span className="text-xs font-medium text-ink-soft">
                                  {q.label}:
                                </span>
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

                          {m.note && (
                            <p className="mt-1.5 border-l-2 border-amber-900/15 pl-2 text-xs leading-snug text-ink-soft">
                              {m.note}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        onChange={paged.goTo}
        labels={{ pageOf: labels.pageOf, prev: labels.prev, next: labels.next }}
      />
    </div>
  );
}
