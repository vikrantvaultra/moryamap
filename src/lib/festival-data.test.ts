import { describe, expect, it } from 'vitest';
import { dayStatus, immersion, immersionMoment, trains, visarjan } from './festival-data';

/** 10:00 IST on an IST calendar date. */
const istMorning = (date: string) => new Date(`${date}T10:00:00+05:30`);

describe('hardcoded festival data', () => {
  const datasets = [
    ['immersion-sites', immersion],
    ['visarjan', visarjan],
    ['trains', trains],
  ] as const;

  it.each(datasets)('%s: every record cites a source that exists', (_, data) => {
    const ids = new Set(data.sources.map((s) => s.id));
    const refs: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (k === 'sourceId' && typeof x === 'string') refs.push(x);
          else if (k === 'sourceIds' && Array.isArray(x)) refs.push(...x);
          else if (k !== 'sources') walk(x);
        }
      }
    };
    walk(data);
    expect(refs.filter((r) => !ids.has(r))).toEqual([]);
  });

  it.each(datasets)('%s: sources have https URLs and years', (_, data) => {
    for (const s of data.sources) {
      expect(s.url, s.id).toMatch(/^https:\/\//);
      expect(s.year, s.id).toBeGreaterThan(2000);
    }
  });

  it('immersion dates fall inside the festival window', () => {
    for (const d of immersion.dates) {
      expect(d.date >= '2026-09-14' && d.date <= '2026-09-26', d.date).toBe(true);
    }
  });

  it('pins are inside Greater Mumbai bounds when present', () => {
    const inBounds = (lat: number | null, lng: number | null) =>
      lat == null || lng == null || (lat > 18.85 && lat < 19.35 && lng > 72.7 && lng < 73.15);
    for (const s of immersion.sites) expect(inBounds(s.lat, s.lng), s.id).toBe(true);
    for (const c of visarjan.procession.checkpoints)
      expect(inBounds(c.lat, c.lng), c.id).toBe(true);
  });
});

describe('dayStatus / immersionMoment', () => {
  it('labels dates relative to the IST day', () => {
    const now = istMorning('2026-09-18');
    expect(dayStatus('2026-09-18', now)).toBe('today');
    expect(dayStatus('2026-09-19', now)).toBe('tomorrow');
    expect(dayStatus('2026-09-15', now)).toBe('past');
    expect(dayStatus('2026-09-25', now)).toBe('upcoming');
  });

  it('uses IST, not UTC, at the day boundary', () => {
    // 00:30 IST on the 18th is still the 17th in UTC.
    const now = new Date('2026-09-18T00:30:00+05:30');
    expect(dayStatus('2026-09-18', now)).toBe('today');
  });

  it('finds today or tomorrow from the dataset', () => {
    const [first] = [...immersion.dates].sort((a, b) => a.date.localeCompare(b.date));
    if (!first) return;
    expect(immersionMoment(istMorning(first.date))).toMatchObject({ when: 'today', day: first });
    expect(immersionMoment(istMorning('2026-01-01'))).toBeNull();
  });
});
