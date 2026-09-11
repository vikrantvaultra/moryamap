'use client';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { updateMandal } from '@/app/(admin)/admin/actions';

export interface EditorEntryPoint {
  id: number;
  sequence: number;
  landmark: string;
  landmarkMr: string | null;
  lat: number | null;
  lng: number | null;
  impliedMinutes: number | null;
}

export interface EditorQueue {
  id: number;
  label: string;
  baseMinutes: number;
  entryLat: number | null;
  entryLng: number | null;
  entryPoints: EditorEntryPoint[];
}

export interface EditorMandal {
  id: number;
  name: string;
  area: string;
  tier: string;
  idolLat: number | null;
  idolLng: number | null;
  nearestStation: string | null;
  stationWalkMinutes: number | null;
  notes: string;
}

type Coord = { lat: string; lng: string };

const inputCls =
  'w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900';

function CoordFields({
  label,
  targetKey,
  coords,
  active,
  setActive,
  setCoords,
  names,
}: {
  label: string;
  targetKey: string;
  coords: Record<string, Coord>;
  active: string | null;
  setActive: (k: string | null) => void;
  setCoords: (k: string, c: Coord) => void;
  names: [string, string];
}) {
  const c = coords[targetKey] ?? { lat: '', lng: '' };
  const isActive = active === targetKey;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <span className="w-40 text-xs font-semibold text-stone-600">{label}</span>
      <input
        name={names[0]}
        value={c.lat}
        onChange={(e) => setCoords(targetKey, { ...c, lat: e.target.value })}
        placeholder="lat"
        className={`${inputCls} !w-28`}
        inputMode="decimal"
      />
      <input
        name={names[1]}
        value={c.lng}
        onChange={(e) => setCoords(targetKey, { ...c, lng: e.target.value })}
        placeholder="lng"
        className={`${inputCls} !w-28`}
        inputMode="decimal"
      />
      <button
        type="button"
        onClick={() => setActive(isActive ? null : targetKey)}
        className={`rounded px-2.5 py-1.5 text-xs font-bold ${
          isActive ? 'bg-orange-600 text-white' : 'bg-stone-200 text-stone-700'
        }`}
      >
        {isActive ? 'Click map…' : '📍 Pick on map'}
      </button>
      {c.lat && (
        <button
          type="button"
          onClick={() => setCoords(targetKey, { lat: '', lng: '' })}
          className="text-xs text-red-700 underline"
        >
          clear
        </button>
      )}
    </div>
  );
}

export default function MandalEditor({
  mandal,
  queues,
  saved,
  err,
}: {
  mandal: EditorMandal;
  queues: EditorQueue[];
  saved: boolean;
  err: string | null;
}) {
  const initial: Record<string, Coord> = {
    idol: { lat: mandal.idolLat?.toString() ?? '', lng: mandal.idolLng?.toString() ?? '' },
  };
  for (const q of queues) {
    initial[`q_${q.id}`] = {
      lat: q.entryLat?.toString() ?? '',
      lng: q.entryLng?.toString() ?? '',
    };
    for (const ep of q.entryPoints) {
      initial[`ep_${ep.id}`] = { lat: ep.lat?.toString() ?? '', lng: ep.lng?.toString() ?? '' };
    }
  }

  const [coords, setCoordsState] = useState<Record<string, Coord>>(initial);
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const setCoordsRef = useRef<(k: string, c: Coord) => void>(() => {});

  const setCoords = (k: string, c: Coord) => setCoordsState((prev) => ({ ...prev, [k]: c }));
  setCoordsRef.current = setCoords;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [72.88, 19.05],
      zoom: 10.5,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    map.on('click', (e) => {
      const target = activeRef.current;
      if (!target) return;
      setCoordsRef.current(target, {
        lat: e.lngLat.lat.toFixed(6),
        lng: e.lngLat.lng.toFixed(6),
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep markers in sync with coordinate state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [key, c] of Object.entries(coords)) {
      const lat = Number(c.lat);
      const lng = Number(c.lng);
      const valid = c.lat !== '' && c.lng !== '' && Number.isFinite(lat) && Number.isFinite(lng);
      const existing = markersRef.current.get(key);
      if (!valid) {
        existing?.remove();
        markersRef.current.delete(key);
        continue;
      }
      if (existing) {
        existing.setLngLat([lng, lat]);
      } else {
        const marker = new maplibregl.Marker({
          color: key === 'idol' ? '#7c2d12' : key.startsWith('q_') ? '#ea580c' : '#f59e0b',
        })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      }
    }
  }, [coords]);

  return (
    <form action={updateMandal} className="space-y-6">
      <input type="hidden" name="id" value={mandal.id} />

      {saved && (
        <p className="rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-800">
          Saved. Live pages refresh within a minute.
        </p>
      )}
      {err === 'bounds' && (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
          Not saved — a coordinate was outside the Mumbai region. Check the pins.
        </p>
      )}

      <div className="rounded-lg border border-stone-300 bg-white p-4">
        <h2 className="text-sm font-bold">
          {mandal.name} <span className="font-normal text-stone-500">· {mandal.area} · tier {mandal.tier.toUpperCase()}</span>
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Nearest station
            <input name="nearestStation" defaultValue={mandal.nearestStation ?? ''} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Station walk minutes
            <input
              name="stationWalkMinutes"
              defaultValue={mandal.stationWalkMinutes ?? ''}
              className={`${inputCls} mt-1`}
              inputMode="numeric"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs font-semibold text-stone-600">
          Notes (markdown, shown publicly)
          <textarea name="notes" defaultValue={mandal.notes} rows={4} className={`${inputCls} mt-1`} />
        </label>
        <div className="mt-3">
          <CoordFields
            label="Idol / mandap pin"
            targetKey="idol"
            coords={coords}
            active={active}
            setActive={setActive}
            setCoords={setCoords}
            names={['idolLat', 'idolLng']}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-300">
        <div ref={mapContainer} className="h-80 w-full" />
        <p className="bg-stone-50 px-3 py-2 text-xs text-stone-500">
          Select “Pick on map” on any pin, then click the map. Verify against ground truth — a
          wrong pin in a crowd is worse than no pin.
        </p>
      </div>

      {queues.map((q) => (
        <div key={q.id} className="rounded-lg border border-stone-300 bg-white p-4">
          <h3 className="text-sm font-bold">
            Queue: {q.label} <span className="font-mono text-xs text-stone-400">#{q.id}</span>
          </h3>
          <div className="mt-2 flex items-end gap-3">
            <label className="text-xs font-semibold text-stone-600">
              Base minutes (neutral hour)
              <input
                name={`q_${q.id}_baseMinutes`}
                defaultValue={q.baseMinutes}
                className={`${inputCls} mt-1 !w-28`}
                inputMode="numeric"
              />
            </label>
          </div>
          <div className="mt-3">
            <CoordFields
              label="Default queue start"
              targetKey={`q_${q.id}`}
              coords={coords}
              active={active}
              setActive={setActive}
              setCoords={setCoords}
              names={[`q_${q.id}_entryLat`, `q_${q.id}_entryLng`]}
            />
          </div>

          {q.entryPoints.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-stone-200 pt-3">
              <p className="text-xs font-bold uppercase text-stone-500">
                Holding points (1 = closest to idol)
              </p>
              {q.entryPoints.map((ep) => (
                <div key={ep.id} className="space-y-2 rounded bg-stone-50 p-2.5">
                  <div className="flex flex-wrap items-end gap-2">
                    <span className="w-6 text-sm font-bold text-stone-500">{ep.sequence}</span>
                    <input
                      name={`ep_${ep.id}_landmark`}
                      defaultValue={ep.landmark}
                      placeholder="Landmark (English)"
                      className={`${inputCls} !w-56`}
                    />
                    <input
                      name={`ep_${ep.id}_landmarkMr`}
                      defaultValue={ep.landmarkMr ?? ''}
                      placeholder="खूण (मराठी)"
                      className={`${inputCls} !w-56`}
                    />
                    <label className="text-xs text-stone-500">
                      implied min
                      <input
                        name={`ep_${ep.id}_implied`}
                        defaultValue={ep.impliedMinutes ?? ''}
                        className={`${inputCls} !w-20`}
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                  <CoordFields
                    label="Pin"
                    targetKey={`ep_${ep.id}`}
                    coords={coords}
                    active={active}
                    setActive={setActive}
                    setCoords={setCoords}
                    names={[`ep_${ep.id}_lat`, `ep_${ep.id}_lng`]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button
        type="submit"
        className="w-full rounded-lg bg-maroon px-4 py-2.5 text-sm font-bold text-white sm:w-auto sm:px-8"
      >
        Save everything
      </button>
    </form>
  );
}
