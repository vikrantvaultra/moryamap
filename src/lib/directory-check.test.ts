import { describe, expect, it } from 'vitest';
import staticDirectory from '@/db/static-directory.json';
import { directoryProblems } from './directory-check';
import type { MandalData } from './queries';

const dir = staticDirectory as MandalData[];

describe('hardcoded mandal directory', () => {
  it('has every mandal unique and pinned on the map', () => {
    expect(directoryProblems(dir)).toEqual([]);
  });

  it('flags duplicates and missing pins', () => {
    const [a] = dir;
    const copy = { ...a, id: 99999, slug: 'copy', idolLat: null, idolLng: null };
    const problems = directoryProblems([a, copy]);
    expect(problems).toContain('duplicate name: ' + a.slug + ' and copy');
    expect(problems).toContain('no map pin: copy');
  });
});
