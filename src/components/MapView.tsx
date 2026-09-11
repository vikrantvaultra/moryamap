'use client';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PublicSnapshot, SnapshotMandal, SnapshotQueue } from '@/lib/snapshot';

export interface MapStrings {
  loading: string;
  noPins: string;
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
  bands: Record<'green' | 'amber' | 'red' | 'deepred', string>;
}

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
  queue: SnapshotQueue;
}

export default function MapView({ strings, locale }: { strings: MapStrings; locale: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [72.88, 19.05],
      zoom: 10.6,
      minZoom: 8.5,
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
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Place markers whenever snapshot data arrives.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !snapshot) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const mandal of snapshot.mandals) {
      for (const queue of mandal.queues) {
        if (queue.entryLat == null || queue.entryLng == null) continue;
        const el = document.createElement('div');
        el.className = `qmarker qmarker--${queue.wait.band}`;
        el.setAttribute('role', 'button');
        el.setAttribute(
          'aria-label',
          `${displayName(mandal, locale)} — ${queue.label}: ${rangeText(queue.wait, strings)}`,
        );
        el.appendChild(document.createElement('span'));
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          document
            .querySelectorAll('.qmarker--active')
            .forEach((n) => n.classList.remove('qmarker--active'));
          el.classList.add('qmarker--active');
          setSelected({ mandal, queue });
          map.easeTo({
            center: [queue.entryLng!, queue.entryLat!],
            zoom: Math.max(map.getZoom(), 13.5),
            padding: { bottom: 220 },
          });
        });
        markersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([queue.entryLng, queue.entryLat])
            .addTo(map),
        );
      }
    }

    const close = () => {
      setSelected(null);
      document
        .querySelectorAll('.qmarker--active')
        .forEach((n) => n.classList.remove('qmarker--active'));
    };
    map.on('click', close);
    return () => {
      map.off('click', close);
    };
  }, [snapshot, locale, strings]);

  const markerCount =
    snapshot?.mandals.reduce(
      (acc, m) => acc + m.queues.filter((q) => q.entryLat != null && q.entryLng != null).length,
      0,
    ) ?? 0;

  const prefix = locale === 'en' ? '' : `/${locale}`;

  return (
    <div className="relative h-[56dvh] min-h-[340px] w-full bg-cream-deep">
      {/* Explicit height: maplibre's CSS forces position:relative on this el,
          so absolute-inset positioning would collapse it to 0 height. */}
      <div ref={containerRef} className="h-full w-full" />

      {!loaded && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-ink-soft shadow">
            {strings.loading}
          </span>
        </div>
      )}

      {loaded && markerCount === 0 && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-10">
          <p className="mx-auto max-w-md rounded-xl bg-white/95 p-3 text-center text-sm text-ink-soft shadow-md">
            {strings.noPins}
          </p>
        </div>
      )}

      {selected && (
        <div className="sheet-enter absolute inset-x-0 bottom-0 z-20 px-3 pb-3">
          <div className="card mx-auto max-w-md p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold leading-tight text-maroon">
                  {displayName(selected.mandal, locale)}
                </h3>
                <p className="text-xs font-medium text-ink-soft">
                  {(locale !== 'en' && selected.queue.labelMr) || selected.queue.label} ·{' '}
                  {strings.queueStart}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="grid size-7 shrink-0 place-items-center rounded-full bg-cream-deep text-ink-soft"
              >
                ✕
              </button>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={`${BAND_BG[selected.queue.wait.band]} rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white`}
              >
                {strings.bands[selected.queue.wait.band]}
              </span>
              <span className="text-2xl font-bold tabular-nums text-ink">
                {rangeText(selected.queue.wait, strings)}
              </span>
            </div>
            <p
              className={`mt-1 text-xs font-medium ${
                selected.queue.wait.provenance === 'reported' ? 'text-band-green' : 'text-ink-soft'
              }`}
            >
              {selected.queue.wait.provenance === 'reported' ? '● ' : ''}
              {provenanceText(selected.queue.wait, strings)}
            </p>
            {selected.queue.wait.provenance === 'reported' && selected.queue.wait.reportedLandmark && (
              <p className="mt-0.5 text-xs text-ink-soft">
                {fmt(strings.lineStartsAt, {
                  landmark:
                    (locale !== 'en' && selected.queue.wait.reportedLandmarkMr) ||
                    selected.queue.wait.reportedLandmark,
                })}
              </p>
            )}
            <p className="mt-1 text-xs italic text-ink-soft/90">{strings.disclaimer}</p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.queue.entryLat},${selected.queue.entryLng}&travelmode=walking`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-maroon px-2 py-2 text-amber-50"
              >
                {strings.directions} ↗
              </a>
              <Link
                href={`${prefix}/m/${selected.mandal.slug}`}
                className="rounded-lg bg-cream-deep px-2 py-2 text-maroon"
              >
                {strings.details}
              </Link>
              <Link
                href={`${prefix}/report/${selected.queue.id}`}
                className="rounded-lg border-2 border-flame px-2 py-1.5 text-flame"
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
