'use client';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pinLabelKey } from '@/lib/names';
import { nearestTo } from '@/lib/map-hit';
import { firstRealNote } from '@/lib/notes';
import type { PublicSnapshot, SnapshotMandal, SnapshotQueue } from '@/lib/snapshot';
import { compareWards, regionOfWard, wardLabel, REGIONS, type Region } from '@/lib/wards';

export interface MapStrings {
  loading: string;
  noPins: string;
  mapNote: string;
  approxLocation: string;
  areaOnly: string;
  mandalLocation: string;
  queueStart: string;
  directions: string;
  details: string;
  report: string;
  disclaimer: string;
  estimateLabel: string;
  reportedLabel: string;
  reportedJustNow: string;
  lineStartsAt: string;
  hours: string;
  minutes: string;
  minutesUpTo: string;
  all: string;
  regions: Record<Region, string>;
  wardWord: string;
  filterRegion: string;
  filterWard: string;
  /** "{shown} of {total} mandals" */
  showing: string;
  clusterHint: string;
  searchPlaceholder: string;
  noResults: string;
  nearestStation: string;
  bands: Record<'green' | 'amber' | 'red' | 'deepred', string>;
}

const BAND_COLOR: Record<string, string> = {
  green: '#15803d',
  amber: '#b45309',
  red: '#dc2626',
  deepred: '#7f1d1d',
};
const MAROON = '#7c2d12';
const MARIGOLD = '#f59e0b';

const SOURCE = 'mandals';
const L_CLUSTER = 'mandal-clusters';
const L_COUNT = 'mandal-cluster-count';
const L_PIN = 'mandal-pin';
const L_SELECTED = 'mandal-pin-selected';
/**
 * Transparent, finger-sized circles under the visible ones. A rendered pin
 * is 15-19 px across, so a mouse hits it and a fingertip - whose contact
 * patch is nearer 40 px, and whose centroid lands 10-15 px from where the
 * user aimed - does not. Taps are hit-tested against this layer instead.
 */
const L_HIT = 'mandal-hit';
/** Half a 44 px touch target, the Apple/Android floor. */
const HIT_RADIUS = 22;

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function hoursLabel(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(/\.0$/, '');
}

function rangeText(wait: SnapshotQueue['wait'], s: MapStrings): string {
  if (wait.unit === 'hr') {
    return fmt(s.hours, { low: hoursLabel(wait.lowMinutes), high: hoursLabel(wait.highMinutes) });
  }
  if (wait.lowMinutes === 0) return fmt(s.minutesUpTo, { high: wait.highMinutes });
  return fmt(s.minutes, { low: wait.lowMinutes, high: wait.highMinutes });
}

function provenanceText(wait: SnapshotQueue['wait'], s: MapStrings): string {
  if (wait.provenance === 'reported' && wait.reportedAt) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(wait.reportedAt).getTime()) / 60_000));
    return mins < 1 ? s.reportedJustNow : fmt(s.reportedLabel, { mins });
  }
  return s.estimateLabel;
}

function displayName(m: SnapshotMandal, locale: string): string {
  if (locale === 'mr' && m.nameMr) return m.nameMr;
  if (locale === 'hi' && m.nameHi) return m.nameHi;
  return m.name;
}

const BAND_BG: Record<string, string> = {
  green: 'bg-band-green',
  amber: 'bg-band-amber',
  red: 'bg-band-red',
  deepred: 'bg-band-deepred',
};

interface Selection {
  mandal: SnapshotMandal;
  /** null → the approximate mandal-location pin was tapped. */
  queue: SnapshotQueue | null;
}

/** One map pin: a verified queue start, or the mandal's own location. */
interface Pin {
  /** Stable feature id — the index into the pin array. */
  id: number;
  mandal: SnapshotMandal;
  queue: SnapshotQueue | null;
  lat: number;
  lng: number;
  band: string;
  region: Region;
  ward: string | null;
  search: string;
}

function buildPins(snapshot: PublicSnapshot): Pin[] {
  const pins: Pin[] = [];
  for (const mandal of snapshot.mandals) {
    const search = [mandal.name, mandal.nameMr, mandal.nameHi, mandal.area, mandal.ward, ...mandal.aliases]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const common = {
      mandal,
      region: regionOfWard(mandal.ward),
      ward: mandal.ward,
      search,
    };
    const queuePins = mandal.queues.filter((q) => q.entryLat != null && q.entryLng != null);
    for (const queue of queuePins) {
      pins.push({
        id: pins.length,
        ...common,
        queue,
        lat: queue.entryLat!,
        lng: queue.entryLng!,
        band: queue.wait.band,
      });
    }
    // The mandal's own location, only when no verified queue pin exists.
    if (queuePins.length === 0 && mandal.idolLat != null && mandal.idolLng != null) {
      pins.push({
        id: pins.length,
        ...common,
        queue: null,
        lat: mandal.idolLat,
        lng: mandal.idolLng,
        band: 'approx',
      });
    }
  }
  return pins;
}

function toGeoJson(pins: Pin[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      id: p.id,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { pin: p.id, band: p.band, approx: p.queue == null },
    })),
  };
}

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
      className={`pointer-events-auto shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-md transition-colors ${
        active ? 'bg-maroon text-amber-50' : 'bg-white/95 text-ink-soft hover:text-maroon'
      }`}
    >
      {children}
      {count != null && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
    </button>
  );
}

/**
 * The whole directory on one map. Pins go through a clustered GeoJSON
 * source rather than one DOM marker each: 139 markers already janks a
 * mid-range phone on pan, and the directory only grows. Region and ward
 * filters narrow what's plotted; search flies to a single mandal.
 */
export default function MapView({ strings, locale }: { strings: MapStrings; locale: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pinsRef = useRef<Pin[]>([]);
  const didFitRef = useRef(false);
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [styleReady, setStyleReady] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [selectedPin, setSelectedPin] = useState<number | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [ward, setWard] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/snapshot.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) {
          setSnapshot(data);
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const allPins = useMemo(() => (snapshot ? buildPins(snapshot) : []), [snapshot]);
  pinsRef.current = allPins;

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allPins.filter((p) => p.search.includes(q)) : allPins;
  }, [allPins, query]);

  const regionCounts = useMemo(() => {
    const c = new Map<Region, number>();
    for (const p of searched) c.set(p.region, (c.get(p.region) ?? 0) + 1);
    return c;
  }, [searched]);

  const wardCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of searched) {
      if (region && p.region !== region) continue;
      if (p.ward) c.set(p.ward, (c.get(p.ward) ?? 0) + 1);
    }
    return c;
  }, [searched, region]);

  const wards = useMemo(() => [...wardCounts.keys()].sort(compareWards), [wardCounts]);

  const visible = useMemo(
    () => searched.filter((p) => (!region || p.region === region) && (!ward || p.ward === ward)),
    [searched, region, ward],
  );

  const close = useCallback(() => {
    setSelected(null);
    setSelectedPin(null);
  }, []);

  // --- map setup ------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [72.87, 19.0], // island city, where most big mandals are
      zoom: 11,
      minZoom: 8.5,
      // Default is 3 px. A tap on glass almost always drifts further than
      // that, and MapLibre then classes it as a drag and emits no click at
      // all - which is why pins opened with a mouse but not with a thumb.
      clickTolerance: 8,
      // Generous bounds: tighter ones can be narrower than a desktop
      // viewport, which wedges MapLibre into a state where it never
      // requests tiles at all.
      maxBounds: [
        [71.5, 17.9],
        [74.5, 20.2],
      ],
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
      'top-right',
    );
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as Record<string, unknown>).__morya_map = map;
      map.on('error', (e) => console.warn('[map error]', e.error?.message ?? e));
    }

    map.on('load', () => {
      map.addSource(SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        // Khetwadi alone has nine mandals inside 300 m, so clusters have to
        // break apart early or the densest galli stays a single dot.
        clusterRadius: 38,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: L_HIT,
        type: 'circle',
        source: SOURCE,
        paint: {
          // Fully transparent, but still hit-tested: queryRenderedFeatures
          // goes by geometry and radius, not by what you can see.
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': [
            'case',
            ['has', 'point_count'],
            ['step', ['get', 'point_count'], HIT_RADIUS, 5, HIT_RADIUS + 4, 15, HIT_RADIUS + 8],
            HIT_RADIUS,
          ],
        },
      });

      map.addLayer({
        id: L_CLUSTER,
        type: 'circle',
        source: SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': MAROON,
          'circle-opacity': 0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fdf9f2',
          'circle-radius': ['step', ['get', 'point_count'], 15, 5, 19, 15, 24],
        },
      });
      map.addLayer({
        id: L_COUNT,
        type: 'symbol',
        source: SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#fdf9f2' },
      });
      map.addLayer({
        id: L_PIN,
        type: 'circle',
        source: SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          // Verified queue starts are filled with their wait band; an
          // approximate mandal location stays a hollow ring, as on the list.
          'circle-color': [
            'match',
            ['get', 'band'],
            'green', BAND_COLOR.green,
            'amber', BAND_COLOR.amber,
            'red', BAND_COLOR.red,
            'deepred', BAND_COLOR.deepred,
            '#ffffff',
          ],
          'circle-radius': ['case', ['get', 'approx'], 6, 7.5],
          'circle-stroke-width': ['case', ['get', 'approx'], 3, 2],
          'circle-stroke-color': ['case', ['get', 'approx'], MAROON, '#ffffff'],
        },
      });
      map.addLayer({
        id: L_SELECTED,
        type: 'circle',
        source: SOURCE,
        filter: ['==', ['get', 'pin'], -1],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': 13,
          'circle-stroke-width': 3,
          'circle-stroke-color': MARIGOLD,
        },
      });

      map.on('mouseenter', L_HIT, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', L_HIT, () => (map.getCanvas().style.cursor = ''));
      setStyleReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  // --- data + interaction ---------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(toGeoJson(visible));

    // Selecting a pin that a filter just removed would strand the sheet.
    setSelectedPin((prev) => (prev != null && visible.some((p) => p.id === prev) ? prev : null));
  }, [visible, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    if (map.getLayer(L_SELECTED)) {
      map.setFilter(L_SELECTED, ['==', ['get', 'pin'], selectedPin ?? -1]);
    }
  }, [selectedPin, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    // One handler over the fat hit layer. Separate per-layer handlers would
    // both fire once the targets are finger-sized and overlapping.
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: [L_HIT] });
      if (hits.length === 0) {
        close();
        return;
      }

      // A 44 px target covers several mandals in a Khetwadi lane, so take
      // the one actually closest to the finger, not the first match.
      const best = nearestTo(e.point, hits, (hit) =>
        map.project((hit.geometry as GeoJSON.Point).coordinates as [number, number]),
      );
      if (!best) return;

      const clusterId = best.properties?.cluster_id;
      if (clusterId != null) {
        const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource;
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) =>
            map.easeTo({
              center: (best.geometry as GeoJSON.Point).coordinates as [number, number],
              zoom,
            }),
          )
          .catch(() => {});
        return;
      }

      const index = best.properties?.pin;
      const pin = index == null ? undefined : pinsRef.current[index as number];
      if (!pin) return;
      setSelected({ mandal: pin.mandal, queue: pin.queue });
      setSelectedPin(pin.id);
      map.easeTo({
        center: [pin.lng, pin.lat],
        zoom: Math.max(map.getZoom(), 14),
        // Room for the sheet, but never more than the map has: on a short
        // phone viewport a fixed 280 would shove the pin off the top.
        padding: { bottom: Math.min(280, Math.round(map.getCanvas().clientHeight * 0.45)) },
      });
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [styleReady, close]);

  // Frame the pins once, so the first view is the mandals — not open sea.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || didFitRef.current || allPins.length === 0) return;
    didFitRef.current = true;
    const bounds = new maplibregl.LngLatBounds();
    allPins.forEach((p) => bounds.extend([p.lng, p.lat]));
    // Asymmetric: the honesty note, legend and filter button stack down the
    // top-left, and a pin underneath them reads as a missing pin.
    map.fitBounds(bounds, {
      padding: { top: 96, left: 96, right: 48, bottom: 48 },
      maxZoom: 14.5,
      duration: 0,
    });
  }, [allPins, styleReady]);

  // A filter change reframes what's left, so you see the ward you picked.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !didFitRef.current) return;
    if (visible.length === 0 || visible.length === allPins.length) return;
    const bounds = new maplibregl.LngLatBounds();
    visible.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, {
      padding: { top: 96, left: 96, right: 48, bottom: 48 },
      maxZoom: 15,
      duration: 500,
    });
  }, [region, ward, query, styleReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const prefix = locale === 'en' ? '' : `/${locale}`;
  const shownQueue = selected ? (selected.queue ?? selected.mandal.queues[0] ?? null) : null;
  const isApprox = selected != null && selected.queue == null;
  const dirTarget = selected
    ? isApprox
      ? { lat: selected.mandal.idolLat, lng: selected.mandal.idolLng }
      : { lat: selected.queue!.entryLat, lng: selected.queue!.entryLng }
    : null;
  const filtersOn = region != null || ward != null || query.trim() !== '';

  return (
    <div className="relative h-full w-full bg-cream-deep">
      <div ref={containerRef} className="h-full w-full" />

      {/* Honesty note + legend live ON the map so they're always visible. */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex w-[calc(100%-1.5rem)] flex-col items-start gap-1.5">
        {/* The note and legend clear the zoom/locate controls at top right;
            the filter block below them spans the full width instead. */}
        <p className="max-w-[calc(100%-3rem)] rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-maroon shadow-md">
          📍 {strings.mapNote}
        </p>
        <div className="flex max-w-[calc(100%-3rem)] flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md">
          {(['green', 'amber', 'red', 'deepred'] as const).map((b) => (
            <span key={b} className="flex items-center gap-1 text-[10px] font-medium text-ink-soft">
              <span className={`size-2 rounded-full ${BAND_BG[b]}`} aria-hidden />
              {strings.bands[b]}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[10px] font-medium text-ink-soft">
            <span className="size-2.5 rounded-full border-2 border-maroon bg-white" aria-hidden />≈
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-ink-soft">
            <span
              className="grid size-3.5 place-items-center rounded-full bg-maroon text-[7px] font-bold text-cream"
              aria-hidden
            >
              9
            </span>
            <span className="hidden sm:inline">{strings.clusterHint}</span>
            <span className="sr-only sm:hidden">{strings.clusterHint}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          className={`pointer-events-auto rounded-lg px-2.5 py-1.5 text-[11px] font-semibold shadow-md ${
            filtersOn ? 'bg-maroon text-amber-50' : 'bg-white/95 text-maroon'
          }`}
        >
          ⚲ {fmt(strings.showing, { shown: visible.length, total: allPins.length })}
        </button>

        {showFilters && (
          <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-white/97 p-2.5 shadow-lg backdrop-blur">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.searchPlaceholder}
              aria-label={strings.searchPlaceholder}
              className="w-full rounded-lg border border-amber-900/15 bg-white px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-flame"
            />
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label={strings.filterRegion}>
              <Chip
                active={region == null}
                onClick={() => {
                  setRegion(null);
                  setWard(null);
                }}
                count={searched.length}
              >
                {strings.all}
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
                  {strings.regions[r]}
                </Chip>
              ))}
            </div>
            {wards.length > 1 && (
              <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1" aria-label={strings.filterWard}>
                {wards.map((w) => (
                  <Chip
                    key={w}
                    active={ward === w}
                    onClick={() => setWard(ward === w ? null : w)}
                    count={wardCounts.get(w)}
                  >
                    {wardLabel(w, strings.wardWord)}
                  </Chip>
                ))}
              </div>
            )}
            {visible.length === 0 && (
              <p className="mt-1 text-[11px] text-ink-soft">{strings.noResults}</p>
            )}
          </div>
        )}

        {loaded && allPins.length === 0 && (
          <p className="max-w-xs rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] leading-snug text-ink-soft shadow-md">
            {strings.noPins}
          </p>
        )}
      </div>

      {!loaded && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-ink-soft shadow">
            {strings.loading}
          </span>
        </div>
      )}

      {selected && shownQueue && (
        <div className="sheet-enter absolute inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="card mx-auto max-h-[60dvh] max-w-md overflow-y-auto p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold leading-tight text-maroon">
                  {displayName(selected.mandal, locale)}
                </h3>
                <p className="text-xs font-medium text-ink-soft">
                  {(locale !== 'en' && shownQueue.labelMr) || shownQueue.label}
                  {!isApprox && <> · {strings.queueStart}</>}
                </p>
                {selected.mandal.aliases.length > 0 && (
                  <p className="mt-0.5 text-xs italic leading-snug text-ink-soft">
                    {selected.mandal.aliases.join(' · ')}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                    {selected.mandal.area}
                  </span>
                  {selected.mandal.ward && (
                    <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                      {wardLabel(selected.mandal.ward, strings.wardWord)}
                    </span>
                  )}
                </p>
                {selected.mandal.address && (
                  <p className="mt-1 text-xs leading-snug text-ink-soft">
                    {selected.mandal.address}
                  </p>
                )}
                {selected.mandal.nearestStation && (
                  <p className="mt-0.5 text-xs leading-snug text-ink-soft">
                    <span aria-hidden>🚆</span> {strings.nearestStation}:{' '}
                    {selected.mandal.nearestStation}
                  </p>
                )}
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="grid size-7 shrink-0 place-items-center rounded-full bg-cream-deep text-ink-soft"
              >
                ✕
              </button>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={`${BAND_BG[shownQueue.wait.band]} rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white`}
              >
                {strings.bands[shownQueue.wait.band]}
              </span>
              <span className="text-2xl font-bold tabular-nums text-ink">
                {rangeText(shownQueue.wait, strings)}
              </span>
            </div>
            <p
              className={`mt-1 text-xs font-medium ${
                shownQueue.wait.provenance === 'reported' ? 'text-band-green' : 'text-ink-soft'
              }`}
            >
              {shownQueue.wait.provenance === 'reported' ? '● ' : ''}
              {provenanceText(shownQueue.wait, strings)}
            </p>
            {shownQueue.wait.provenance === 'reported' && shownQueue.wait.reportedLandmark && (
              <p className="mt-0.5 text-xs text-ink-soft">
                {fmt(strings.lineStartsAt, {
                  landmark:
                    (locale !== 'en' && shownQueue.wait.reportedLandmarkMr) ||
                    shownQueue.wait.reportedLandmark,
                })}
              </p>
            )}
            {isApprox && (
              <p className="mt-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-maroon">
                {selected.mandal.pinPrecision === 'rooftop' ? '📍' : '≈'}{' '}
                {strings[pinLabelKey(selected.mandal.pinPrecision)]}
              </p>
            )}
            {firstRealNote(selected.mandal.notes) && (
              <p className="mt-1 border-l-2 border-amber-900/15 pl-2 text-xs leading-snug text-ink-soft">
                {firstRealNote(selected.mandal.notes)}
              </p>
            )}
            <p className="mt-1 text-xs italic text-ink-soft/90">{strings.disclaimer}</p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
              {dirTarget?.lat != null && dirTarget?.lng != null ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${dirTarget.lat},${dirTarget.lng}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid place-items-center rounded-lg bg-maroon px-2 py-2 text-amber-50"
                >
                  {strings.directions} ↗
                </a>
              ) : (
                <span />
              )}
              <Link
                href={`${prefix}/m/${selected.mandal.slug}`}
                className="grid place-items-center rounded-lg bg-cream-deep px-2 py-2 text-maroon"
              >
                {strings.details}
              </Link>
              <Link
                href={`${prefix}/report/${shownQueue.id}`}
                className="grid place-items-center rounded-lg border-2 border-flame px-2 py-1.5 text-flame"
              >
                {strings.report}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
