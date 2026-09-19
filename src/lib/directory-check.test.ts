import { describe, expect, it } from 'vitest';
import staticDirectory from '@/db/static-directory.json';
import wardPins from '@/db/ward-pins.json';
import { directoryProblems } from './directory-check';
import { regionOfWard } from './wards';
import type { MandalData } from './queries';

const dir = staticDirectory as MandalData[];

describe('hardcoded mandal directory', () => {
  it('has every mandal unique and pinned on the map', () => {
    expect(directoryProblems(dir)).toEqual([]);
  });

  // The map and the list both filter by ward, so a mandal without one is
  // unreachable in every view but free-text search.
  it('has a BMC ward on every mandal', () => {
    const missing = dir.filter((m) => !m.ward).map((m) => m.slug);
    expect(missing, 'run `npx tsx scripts/assign-wards.ts`').toEqual([]);
  });

  it('sorts every ward into a browse region', () => {
    // 'mmr' is the catch-all, so only a BMC ward letter can be miscategorised.
    const bmc = dir.filter((m) => /^[A-Z](\/[NSEWC])?$/.test(m.ward ?? ''));
    expect(bmc.length).toBeGreaterThan(100);
    expect(bmc.filter((m) => regionOfWard(m.ward) === 'mmr')).toEqual([]);
  });

  it('records where every ward came from', () => {
    const sourced = new Set(wardPins.map((w) => w.slug));
    expect(dir.filter((m) => m.ward && !sourced.has(m.slug)).map((m) => m.slug)).toEqual([]);
  });

  it('flags duplicates and missing pins', () => {
    const [a] = dir;
    const copy = { ...a, id: 99999, slug: 'copy', idolLat: null, idolLng: null };
    const problems = directoryProblems([a, copy]);
    expect(problems).toContain('duplicate name: ' + a.slug + ' and copy');
    expect(problems).toContain('no map pin: copy');
  });
});
