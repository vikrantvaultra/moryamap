'use client';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PublicSnapshot, SnapshotMandal, SnapshotQueue } from '@/lib/snapshot';

export interface MapStrings {
  loading: string;
  noPins: string;
  mapNote: string;
  approxLocation: string;
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

const BAND_DOT = BAND_BG;

interface Selection {
  mandal: SnapshotMandal;
  /** null → the approximate mandal-location marker was tapped. */
  queue: SnapshotQueue | null;
}

function clearActive() {
  document
    .querySelectorAll('.qmarker--active, .amarker--active')
    .forEach((n) => n.classList.remove('qmarker--active', 'amarker--active'));
}

export default function MapView({ strings, locale }: { strings: MapStrings; locale: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const didFitRef = useRef(false);
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
      center: [72.87, 19.0], // island city, where most big mandals are
      zoom: 11,
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

    const select = (sel: Selection, el: HTMLElement, lng: number, lat: number, activeCls: string) => {
      clearActive();
      el.classList.add(activeCls);
      setSelected(sel);
      map.easeTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 13.5),
        padding: { bottom: 260 },
      });
    };

    for (const mandal of snapshot.mandals) {
      let hasQueuePin = false;
      for (const queue of mandal.queues) {
        if (queue.entryLat == null || queue.entryLng == null) continue;
        hasQueuePin = true;
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
          select({ mandal, queue }, el, queue.entryLng!, queue.entryLat!, 'qmarker--active');
        });
        markersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([queue.entryLng, queue.entryLat])
            .addTo(map),
        );
      }

      // Approximate mandal-location dot when no verified queue pin exists.
      if (!hasQueuePin && mandal.idolLat != null && mandal.idolLng != null) {
        const el = document.createElement('div');
        el.className = 'amarker';
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${displayName(mandal, locale)} — ${strings.approxLocation}`);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          select({ mandal, queue: null }, el, mandal.idolLng!, mandal.idolLat!, 'amarker--active');
        });
        markersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([mandal.idolLng, mandal.idolLat])
            .addTo(map),
        );
      }
    }

    // Frame the pins once, so the first view is the mandals — not open sea.
    if (!didFitRef.current && markersRef.current.length > 0) {
      didFitRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      markersRef.current.forEach((mk) => bounds.extend(mk.getLngLat()));
      map.fitBounds(bounds, { padding: 72, maxZoom: 14.5, duration: 0 });
    }

    const close = () => {
      setSelected(null);
      clearActive();
    };
    map.on('click', close);
    return () => {
      map.off('click', close);
    };
  }, [snapshot, locale, strings]);

  const markerCount =
    snapshot?.mandals.reduce(
      (acc, m) =>
        acc +
        m.queues.filter((q) => q.entryLat != null && q.entryLng != null).length +
        (m.idolLat != null && m.idolLng != null ? 1 : 0),
      0,
    ) ?? 0;

  const prefix = locale === 'en' ? '' : `/${locale}`;
  const shownQueue = selected ? (selected.queue ?? selected.mandal.queues[0] ?? null) : null;
  const isApprox = selected != null && selected.queue == null;
  const dirTarget = selected
    ? isApprox
      ? { lat: selected.mandal.idolLat, lng: selected.mandal.idolLng }
      : { lat: selected.queue!.entryLat, lng: selected.queue!.entryLng }
    : null;

  return (
    <div className="relative h-full w-full bg-cream-deep">
      <div ref={containerRef} className="h-full w-full" />

      {/* Honesty note + legend live ON the map so they're always visible. */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-4.5rem)] flex-col items-start gap-1.5">
        <p className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-maroon shadow-md">
          📍 {strings.mapNote}
        </p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md">
          {(['green', 'amber', 'red', 'deepred'] as const).map((b) => (
            <span key={b} className="flex items-center gap-1 text-[10px] font-medium text-ink-soft">
              <span className={`size-2 rounded-full ${BAND_DOT[b]}`} aria-hidden />
              {strings.bands[b]}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[10px] font-medium text-ink-soft">
            <span
              className="size-2.5 rounded-full border-2 border-maroon bg-white"
              aria-hidden
            />
            ≈
          </span>
        </div>
        {loaded && markerCount === 0 && (
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
          <div className="card mx-auto max-w-md p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold leading-tight text-maroon">
                  {displayName(selected.mandal, locale)}
                </h3>
                <p className="text-xs font-medium text-ink-soft">
                  {(locale !== 'en' && shownQueue.labelMr) || shownQueue.label}
                  {!isApprox && <> · {strings.queueStart}</>}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  clearActive();
                }}
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
                ≈ {strings.approxLocation}
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
