import { describe, expect, it } from 'vitest';
import staticDirectory from '@/db/static-directory.json';
import { PIN_SOURCE_NOTES, firstRealNote, isPinSourceNote } from './notes';
import type { MandalData } from './queries';

const dir = staticDirectory as MandalData[];

describe('pin provenance notes', () => {
  it('recognises every boilerplate note', () => {
    for (const note of Object.values(PIN_SOURCE_NOTES)) {
      expect(isPinSourceNote(note), note).toBe(true);
      expect(firstRealNote(note)).toBeNull();
    }
  });

  it('keeps notes that say something about the mandal', () => {
    const notes = `Sarvajanik Ganeshotsav since 1949.\n\n${PIN_SOURCE_NOTES.scraped}`;
    expect(firstRealNote(notes)).toBe('Sarvajanik Ganeshotsav since 1949.');
  });

  /**
   * The list prints firstRealNote per card. If the boilerplate drifted out of
   * sync with what the build script writes, every scraped card would print the
   * same paragraph again — which is exactly what this indirection prevents.
   */
  it('matches what the shipped directory actually carries', () => {
    const boilerplateOnly = dir.filter(
      (m) => m.notes.trim() !== '' && firstRealNote(m.notes) === null,
    );
    expect(boilerplateOnly.length).toBeGreaterThan(200);

    const leaked = dir
      .map((m) => ({ slug: m.slug, note: firstRealNote(m.notes) }))
      .filter((m) => m.note && isPinSourceNote(m.note));
    expect(leaked).toEqual([]);
  });
});
