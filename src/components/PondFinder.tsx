'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { haversineKm, kmLabel } from '@/lib/routes';
import { Pagination, usePaged, type PaginationLabels } from './Pagination';
import type { PondPoint } from './PondMap';

const KIND_COLOR: Record<PondPoint['kind'], string> = {
  artificial: '#0369a1',
  natural: '#0f766e',
  collection: '#ea580c',
};

// Its own code-split map instance, separate from the mandal map.
const PondMap = dynamic(() => import('./PondMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-cream-deep" />,
});

export interface PondItem {
  id: string;
  kind: 'artificial' | 'natural' | 'collection';
  name: string;
  ward: string | null;
  area: string | null;
  address: string | null;
  /** Any geocode, street or area level — used only to sort by distance. */
  lat: number | null;
  lng: number | null;
  /** Street-level pin: safe to offer turn-by-turn directions to. */
  routable: boolean;
  approx: boolean;
  search: string;
  /** Citation marker, e.g. "[2]". */
  cite: string;
  citeHref: string;
}

export interface PondLabels {
  nearMe: string;
  locating: string;
  locationDenied: string;
  sortedNear: string;
  searchPlaceholder: string;
  all: string;
  artificial: string;
  natural: string;
  collection: string;
  ward: string;
  distance: string;
  directions: string;
  findInMaps: string;
  approxPin: string;
  count: string;
  noResults: string;
  pagination: PaginationLabels;
  onMap: string;
  showOnMap: string;
  unpinnedNote: string;
  close: string;
}

const PAGE_SIZE = 10;
const KINDS = ['all', 'artificial', 'natural', 'collection'] as const;

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/**
 * Immersion spot finder. Location never leaves the phone: distances are
 * computed in the browser from the hardcoded list.
 */
export default function PondFinder({ items, labels }: { items: PondItem[]; labels: PondLabels }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<'idle' | 'locating' | 'denied'>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);

  // "Near me" is only meaningful once at least some places have a map pin.
  const canLocate = items.some((i) => i.lat != null && i.lng != null);
  const presentKinds = KINDS.filter((k) => k === 'all' || items.some((i) => i.kind === k));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items
      .filter((i) => kind === 'all' || i.kind === kind)
      .filter((i) => !q || i.search.includes(q))
      .map((i) => ({
        ...i,
        km:
          here && i.lat != null && i.lng != null
            ? haversineKm(here, { lat: i.lat, lng: i.lng })
            : null,
      }));
    if (here) {
      // Pinned places by distance; unpinned ones keep list order at the end.
      list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    }
    return list;
  }, [items, kind, query, here]);

  const points = useMemo<PondPoint[]>(
    () =>
      results
        .filter((i) => i.lat != null && i.lng != null)
        .map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, kind: i.kind, approx: i.approx })),
    [results],
  );
  const paged = usePaged(results, PAGE_SIZE, `${query}|${kind}|${here ? 'near' : ''}`);
  const selected = results.find((i) => i.id === selectedId) ?? null;

  const showOnMap = (id: string) => {
    setSelectedId(id);
    mapBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setGeo('denied');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo('idle');
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  };

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId(null);
        }}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchPlaceholder}
        className="w-full rounded-xl border border-amber-900/15 bg-white px-4 py-3 text-base text-ink shadow-sm outline-none placeholder:text-ink-soft/60 focus:border-flame"
      />
      {canLocate && (
        <button
          type="button"
          onClick={locate}
          disabled={geo === 'locating'}
          className="mt-2 w-full rounded-xl bg-maroon px-4 py-3 text-sm font-bold text-amber-50 shadow-sm hover:bg-maroon-deep disabled:opacity-70"
        >
          <span aria-hidden className="mr-1.5">
            📍
          </span>
          {geo === 'locating' ? labels.locating : labels.nearMe}
        </button>
      )}
      {geo === 'denied' && (
        <p className="mt-2 text-xs font-medium text-band-amber">{labels.locationDenied}</p>
      )}
      {here && <p className="mt-2 text-xs text-ink-soft">{labels.sortedNear}</p>}

      {presentKinds.length > 2 && (
        <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex w-max gap-2">
            {presentKinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setSelectedId(null);
                }}
                aria-pressed={kind === k}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                  kind === k
                    ? 'border-maroon bg-maroon text-amber-50'
                    : 'border-amber-900/15 bg-white text-maroon'
                }`}
              >
                {labels[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {canLocate && (
        <div ref={mapBoxRef} className="mt-3">
          <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-amber-900/10 bg-cream-deep sm:h-96">
            <PondMap points={points} selectedId={selectedId} here={here} onSelect={setSelectedId} />
            <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md">
              {(['artificial', 'natural', 'collection'] as const)
                .filter((k) => items.some((i) => i.kind === k))
                .map((k) => (
                  <span
                    key={k}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-ink-soft"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: KIND_COLOR[k] }}
                      aria-hidden
                    />
                    {labels[k]}
                  </span>
                ))}
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
                <span
                  className="size-2.5 rounded-full border-2 border-ink-soft bg-white"
                  aria-hidden
                />
                ≈
              </span>
            </div>
          </div>

          {selected && (
            <div className="card mt-2 p-3.5 ring-2 ring-marigold">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: KIND_COLOR[selected.kind] }}
                  >
                    {labels[selected.kind]}
                  </p>
                  <h3 className="text-[15px] font-bold leading-snug text-ink">{selected.name}</h3>
                  <p className="text-xs text-ink-soft">
                    {[selected.area, selected.ward && fill(labels.ward, { ward: selected.ward })]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {selected.address && (
                    <p className="mt-0.5 text-xs leading-snug text-ink-soft">{selected.address}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label={labels.close}
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-cream-deep text-ink-soft"
                >
                  ✕
                </button>
              </div>
              <PlaceActions item={selected} labels={labels} />
            </div>
          )}
          <p className="mt-1.5 text-xs text-ink-soft">{labels.unpinnedNote}</p>
        </div>
      )}

      <div ref={paged.topRef} className="scroll-mt-20" />
      <p className="mt-4 text-xs font-semibold text-ink-soft">
        {fill(labels.count, { count: results.length })}
        {canLocate && <> · {fill(labels.onMap, { count: points.length })}</>}
      </p>

      {results.length === 0 ? (
        <p className="card mt-2 p-4 text-sm text-ink-soft">{labels.noResults}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {paged.slice.map((i) => {
            return (
              <li
                key={i.id}
                className={`card p-3.5 ${i.id === selectedId ? 'ring-2 ring-marigold' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: KIND_COLOR[i.kind] }}
                    >
                      {labels[i.kind]}
                    </p>
                    <h3 className="text-[15px] font-bold leading-snug text-ink">
                      {i.name}
                      <a
                        href={i.citeHref}
                        className="ml-1 align-super text-[10px] font-bold text-flame"
                      >
                        {i.cite}
                      </a>
                    </h3>
                    <p className="text-xs text-ink-soft">
                      {[i.area, i.ward && fill(labels.ward, { ward: i.ward })]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {i.address && (
                      <p className="mt-0.5 text-xs leading-snug text-ink-soft">{i.address}</p>
                    )}
                  </div>
                  {i.km != null && (
                    <span className="shrink-0 rounded-full bg-cream-deep px-2 py-0.5 text-xs font-bold tabular-nums text-maroon">
                      {fill(labels.distance, { km: kmLabel(i.km) })}
                    </span>
                  )}
                </div>
                <PlaceActions
                  item={i}
                  labels={labels}
                  onShowOnMap={i.lat != null && i.lng != null ? () => showOnMap(i.id) : undefined}
                />
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
    </div>
  );
}

function PlaceActions({
  item,
  labels,
  onShowOnMap,
}: {
  item: PondItem;
  labels: PondLabels;
  onShowOnMap?: () => void;
}) {
  const mapsQuery = encodeURIComponent(
    [item.name, item.address, item.area, 'Mumbai'].filter(Boolean).join(', '),
  );
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {item.routable && item.lat != null && item.lng != null && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-maroon px-3 py-1.5 text-sm font-semibold text-amber-50"
        >
          {labels.directions}
        </a>
      )}
      {onShowOnMap && (
        <button
          type="button"
          onClick={onShowOnMap}
          className="rounded-lg border-2 border-maroon px-3 py-1 text-sm font-semibold text-maroon hover:bg-maroon hover:text-amber-50"
        >
          <span aria-hidden className="mr-1.5">🗺️</span>
          {labels.showOnMap}
        </button>
      )}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-flame underline"
      >
        {labels.findInMaps}
      </a>
      {item.approx && <span className="text-[11px] text-band-amber">{labels.approxPin}</span>}
    </div>
  );
}
