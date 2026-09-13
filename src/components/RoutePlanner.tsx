'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MAX_STOPS, MIN_STOPS, orderByGeography, parseStopIds } from '@/lib/routes';
import { Pagination, usePaged, type PaginationLabels } from './Pagination';

export interface PlannerMandal {
  id: number;
  name: string;
  area: string;
  idolLat: number;
  idolLng: number;
  areaOnly: boolean;
  search: string;
}

export interface PlannerLabels {
  searchPlaceholder: string;
  add: string;
  added: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  sortGeo: string;
  sortGeoHint: string;
  selected: string;
  empty: string;
  create: string;
  needMore: string;
  full: string;
  areaOnly: string;
  noResults: string;
  pagination: PaginationLabels;
}

const PAGE_SIZE = 10;

/**
 * Route builder. State lives only in the page (and the URL hash when
 * editing an existing route) — the result is a plain /r/1-5-7 link, so no
 * account or storage is involved.
 */
export default function RoutePlanner({
  mandals,
  labels,
  routeBase,
}: {
  mandals: PlannerMandal[];
  labels: PlannerLabels;
  /** Locale-prefixed "/r" path. */
  routeBase: string;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState('');

  // "Edit this route" arrives as /plan#1-5-7.
  useEffect(() => {
    const ids = parseStopIds(window.location.hash.slice(1));
    if (ids) setSelected(ids.filter((id) => mandals.some((m) => m.id === id)));
  }, [mandals]);

  const byId = useMemo(() => new Map(mandals.map((m) => [m.id, m])), [mandals]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? mandals.filter((m) => m.search.includes(q)) : mandals;
  }, [mandals, query]);

  const paged = usePaged(filtered, PAGE_SIZE, query);
  const full = selected.length >= MAX_STOPS;
  const ready = selected.length >= MIN_STOPS;

  const toggle = (id: number) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_STOPS ? s : [...s, id],
    );
  const move = (index: number, delta: number) =>
    setSelected((s) => {
      const next = [...s];
      const target = index + delta;
      if (target < 0 || target >= next.length) return s;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const sortGeo = () =>
    setSelected((s) => orderByGeography(s.map((id) => byId.get(id)!)).map((m) => m.id));

  const iconBtn =
    'grid size-9 shrink-0 place-items-center rounded-full bg-cream-deep text-maroon disabled:opacity-30';

  return (
    <div>
      <section className="card mt-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          {labels.selected
            .replace('{count}', String(selected.length))
            .replace('{max}', String(MAX_STOPS))}
        </h2>
        {selected.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">{labels.empty}</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {selected.map((id, i) => {
              const m = byId.get(id);
              if (!m) return null;
              return (
                <li key={id} className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-maroon text-xs font-bold text-amber-50">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                    <span className="block truncate text-xs text-ink-soft">{m.area}</span>
                  </span>
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={labels.moveUp}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1}
                    aria-label={labels.moveDown}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => toggle(id)}
                    aria-label={labels.remove}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {selected.length > 2 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={sortGeo}
              className="rounded-full border border-maroon px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-maroon hover:text-amber-50"
            >
              <span aria-hidden className="mr-1.5">
                🧭
              </span>
              {labels.sortGeo}
            </button>
            <p className="mt-1 text-xs text-ink-soft">{labels.sortGeoHint}</p>
          </div>
        )}
        {full && <p className="mt-2 text-xs font-medium text-band-amber">{labels.full}</p>}
      </section>

      <div ref={paged.topRef} className="scroll-mt-20" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchPlaceholder}
        className="mt-4 w-full rounded-xl border border-amber-900/15 bg-white px-4 py-2.5 text-base text-ink shadow-sm outline-none placeholder:text-ink-soft/60 focus:border-flame"
      />

      {filtered.length === 0 ? (
        <p className="card mt-3 p-4 text-sm text-ink-soft">{labels.noResults}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {paged.slice.map((m) => {
            const isOn = selected.includes(m.id);
            return (
              <li key={m.id} className="card flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug text-ink">
                    {m.name}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {m.area}
                    {m.areaOnly && <> · {labels.areaOnly}</>}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  disabled={!isOn && full}
                  aria-pressed={isOn}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                    isOn
                      ? 'bg-band-green text-white'
                      : 'border-2 border-flame text-flame hover:bg-flame hover:text-white'
                  }`}
                >
                  {isOn ? `✓ ${labels.added}` : `+ ${labels.add}`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        onChange={paged.goTo}
        labels={labels.pagination}
      />

      {/* Sticky action bar: always reachable by thumb on phones. */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-amber-900/10 bg-cream/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-t-2xl">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-maroon tabular-nums">
            {selected.length}/{MAX_STOPS}
          </span>
          {ready ? (
            <Link
              href={`${routeBase}/${selected.join('-')}`}
              className="flex-1 rounded-xl bg-maroon px-4 py-3 text-center text-sm font-bold text-amber-50 shadow-sm hover:bg-maroon-deep"
            >
              {labels.create}
            </Link>
          ) : (
            <span className="flex-1 rounded-xl bg-cream-deep px-4 py-3 text-center text-sm font-semibold text-ink-soft">
              {labels.needMore}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
