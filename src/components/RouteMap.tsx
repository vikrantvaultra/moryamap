'use client';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

export interface RouteMapPoint {
  lat: number;
  lng: number;
  /** Shown inside the marker, e.g. "1". */
  label: string;
  name: string;
  /** Approximate pins render hollow, like on the home map. */
  approx?: boolean;
}

/**
 * Small embedded map for routes and the procession: numbered markers joined
 * by a dashed straight line (it is NOT a walking path, and looks it).
 * cooperativeGestures keeps one-finger page scrolling working on phones.
 */
export default function RouteMap({
  points,
  line = true,
}: {
  points: RouteMapPoint[];
  line?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [points[0].lng, points[0].lat],
      zoom: 14,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const markers = points.map((p) => {
      const el = document.createElement('div');
      el.className = `rmarker${p.approx ? ' rmarker--approx' : ''}`;
      el.textContent = p.label;
      el.setAttribute('aria-label', `${p.label}. ${p.name}`);
      el.title = p.name;
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    });

    // The container can settle its size after mount (code-split island),
    // so frame the stops again once the style has loaded.
    const frame = () => {
      if (points.length < 2) return;
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.resize();
      map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
    };
    frame();
    map.once('load', frame);

    if (line && points.length > 1) {
      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#7c2d12',
            'line-width': 3,
            'line-dasharray': [2, 2],
            'line-opacity': 0.8,
          },
        });
      });
    }

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
  }, [points, line]);

  return <div ref={ref} className="h-full w-full" />;
}
