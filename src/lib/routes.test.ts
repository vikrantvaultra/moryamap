import { describe, expect, it } from 'vitest';
import staticDirectory from '@/db/static-directory.json';
import type { MandalData } from './queries';
import {
  CIRCUITS,
  MAX_STOPS,
  haversineKm,
  kmLabel,
  legKm,
  orderByGeography,
  parseStopIds,
  resolveCircuit,
  resolveIds,
  resolveRouteKey,
  routeDirectionsChunks,
} from './routes';

const dir = staticDirectory as MandalData[];

describe('curated circuits', () => {
  it('only reference mandals that exist and are pinned', () => {
    for (const c of CIRCUITS) {
      const stops = resolveCircuit(c, dir);
      expect(
        stops.map((s) => s.slug),
        c.id,
      ).toEqual(c.stops);
    }
  });

  it('have unique ids and walkable legs (every leg under 2.5 km straight-line)', () => {
    expect(new Set(CIRCUITS.map((c) => c.id)).size).toBe(CIRCUITS.length);
    for (const c of CIRCUITS) {
      for (const km of legKm(resolveCircuit(c, dir))) expect(km, c.id).toBeLessThan(2.5);
    }
  });
});

describe('parseStopIds', () => {
  it('accepts 2–8 unique ids', () => {
    expect(parseStopIds('1-2')).toEqual([1, 2]);
    expect(parseStopIds('1-2-3-4-5-6-7-8')).toHaveLength(MAX_STOPS);
  });

  it('rejects malformed, single, duplicate and oversized lists', () => {
    for (const bad of [
      '',
      '1',
      '1-1',
      '1-2-3-4-5-6-7-8-9',
      'a-b',
      '1--2',
      '-1-2',
      '1-2-',
      '1.5-2',
    ]) {
      expect(parseStopIds(bad), bad).toBeNull();
    }
  });
});

describe('resolveIds / resolveRouteKey', () => {
  it('keeps the requested order', () => {
    const [a, b, c] = dir;
    expect(resolveIds([c.id, a.id, b.id], dir)?.map((m) => m.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rejects unknown ids', () => {
    expect(resolveIds([dir[0].id, 987654], dir)).toBeNull();
  });

  it('resolves circuit ids and stop lists, and nothing else', () => {
    expect(resolveRouteKey('lalbaug-parel', dir)?.circuit?.id).toBe('lalbaug-parel');
    expect(resolveRouteKey(`${dir[0].id}-${dir[1].id}`, dir)?.stops).toHaveLength(2);
    expect(resolveRouteKey('nope', dir)).toBeNull();
  });
});

describe('geometry', () => {
  it('haversine is roughly right for a known pair (~1.1 km per 0.01° lat)', () => {
    const km = haversineKm({ lat: 19.0, lng: 72.8 }, { lat: 19.01, lng: 72.8 });
    expect(km).toBeGreaterThan(1.05);
    expect(km).toBeLessThan(1.16);
  });

  it('kmLabel never shows zero', () => {
    expect(kmLabel(0)).toBe('0.1 km');
    expect(kmLabel(1.26)).toBe('1.3 km');
  });

  it('orderByGeography keeps the first stop and visits nearest-next', () => {
    const p = (id: number, lat: number) => ({ id, idolLat: lat, idolLng: 72.8 });
    const ordered = orderByGeography([p(1, 19.0), p(2, 19.3), p(3, 19.1), p(4, 19.2)]);
    expect(ordered.map((x) => x.id)).toEqual([1, 3, 4, 2]);
  });
});

describe('routeDirectionsChunks', () => {
  const p = (lat: number) => ({ idolLat: lat, idolLng: 72.8 });

  it('uses one link with ≤3 waypoints for up to 5 stops', () => {
    const chunks = routeDirectionsChunks([p(1), p(2), p(3), p(4), p(5)]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ from: 1, to: 5 });
    expect(
      decodeURIComponent(chunks[0].url)
        .match(/waypoints=([^&]*)/)?.[1]
        .split('|'),
    ).toHaveLength(3);
  });

  it('splits longer routes into overlapping chunks', () => {
    const chunks = routeDirectionsChunks([p(1), p(2), p(3), p(4), p(5), p(6), p(7), p(8)]);
    expect(chunks.map((c) => [c.from, c.to])).toEqual([
      [1, 5],
      [5, 8],
    ]);
  });

  it('omits waypoints for a two-stop route', () => {
    const [only] = routeDirectionsChunks([p(1), p(2)]);
    expect(only.url).not.toContain('waypoints');
  });
});
