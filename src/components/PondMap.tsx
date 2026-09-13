'use client';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

export interface PondPoint {
  id: string;
  lat: number;
  lng: number;
  kind: 'artificial' | 'natural' | 'collection';
  /** Area-level geocode: drawn hollow so it reads as approximate. */
  approx: boolean;
}

export const POND_COLORS: Record<PondPoint['kind'], string> = {
  artificial: '#0369a1',
  natural: '#0f766e',
  collection: '#ea580c',
};

/**
 * Immersion-spot map — deliberately separate from the mandal map: its own
 * instance, its own layers, no mandal data. Points are a GeoJSON circle
 * layer (hundreds of DOM markers would lag on phones).
 */
export default function PondMap({
  points,
  selectedId,
  here,
  onSelect,
}: {
  points: PondPoint[];
  selectedId: string | null;
  here: { lat: number; lng: number } | null;
  onSelect: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const hereMarkerRef = useRef<maplibregl.Marker | null>(null);
  onSelectRef.current = onSelect;

  const toGeoJSON = (pts: PondPoint[]): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: pts.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, color: POND_COLORS[p.kind], approx: p.approx ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  });

  const fit = (map: maplibregl.Map, pts: PondPoint[]) => {
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 15 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    pts.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 0 });
  };

  // Create the map once.
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [72.86, 19.07],
      zoom: 10.5,
      minZoom: 8.5,
      maxBounds: [
        [71.5, 17.9],
        [74.5, 20.2],
      ],
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as Record<string, unknown>).__morya_pond_map = map;
    }
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('ponds', { type: 'geojson', data: toGeoJSON([]) });
      map.addLayer({
        id: 'ponds-dot',
        type: 'circle',
        source: 'ponds',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 9],
          'circle-color': ['case', ['==', ['get', 'approx'], 1], '#ffffff', ['get', 'color']],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'approx'], 1],
            ['get', 'color'],
            '#ffffff',
          ],
          'circle-stroke-width': ['case', ['==', ['get', 'approx'], 1], 3, 2],
        },
      });
      map.addLayer({
        id: 'ponds-selected',
        type: 'circle',
        source: 'ponds',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 13,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#f59e0b',
          'circle-stroke-width': 4,
        },
      });
      map.on('click', 'ponds-dot', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') onSelectRef.current(id);
      });
      map.on('click', (e) => {
        if (map.queryRenderedFeatures(e.point, { layers: ['ponds-dot'] }).length === 0) {
          onSelectRef.current(null);
        }
      });
      map.on('mouseenter', 'ponds-dot', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'ponds-dot', () => (map.getCanvas().style.cursor = ''));
      readyRef.current = true;
      map.fire('ponds:ready');
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Push the filtered points whenever search / filter changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      (map.getSource('ponds') as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(points));
      fit(map, points);
    };
    if (readyRef.current) apply();
    else map.once('ponds:ready', apply);
  }, [points]);

  // Highlight + fly to the selected place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      map.setFilter('ponds-selected', ['==', ['get', 'id'], selectedId ?? '']);
      const p = points.find((x) => x.id === selectedId);
      if (p) map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14.5) });
    };
    if (readyRef.current) apply();
    else map.once('ponds:ready', apply);
  }, [selectedId, points]);

  // "You are here" dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    hereMarkerRef.current?.remove();
    hereMarkerRef.current = null;
    if (!here) return;
    const el = document.createElement('div');
    el.className = 'here-dot';
    hereMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([here.lng, here.lat])
      .addTo(map);
  }, [here]);

  return <div ref={ref} className="h-full w-full" />;
}
