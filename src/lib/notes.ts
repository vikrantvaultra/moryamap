/**
 * Boilerplate notes that say where a pin came from.
 *
 * These are attached to every mandal imported from a source we haven't
 * verified on the ground, so hundreds of mandals carry the identical
 * paragraph. The mandal page shows it in full — that's the honest place
 * for it. The list would print it 300 times, where the precision badge
 * ("≈ Approx. location") already carries the same warning in three words,
 * so the list checks with `isPinSourceNote` and prints only notes that say
 * something about *that* mandal.
 */

export const PIN_SOURCE_NOTES = {
  /** An unverified row from the community dataset. */
  community:
    'Map pin is approximate — from an earlier community list, not verified. Confirm locally before you go.',
  /** A neighbourhood-level pin: we know the area, not the pandal. */
  area: 'Map pin marks the neighbourhood only — the exact pandal spot isn’t known. Ask locally for directions.',
  /** An OpenStreetMap feature named for the mandal. */
  osm: 'Location from OpenStreetMap — it marks the mandal’s own premises, not a verified pandal or queue start. Confirm locally before you go.',
  /** A pin published by one of the public Ganeshotsav directories. */
  scraped:
    'Location from a public Ganeshotsav directory — the mandal’s own spot as that directory lists it, not verified by us and never a queue start. Confirm locally before you go.',
} as const;

const ALL = Object.values(PIN_SOURCE_NOTES) as string[];

/** Is this line one of the shared provenance notes rather than real detail? */
export function isPinSourceNote(line: string): boolean {
  const l = line.trim();
  return ALL.some((n) => n === l);
}

/** The first line of a mandal's notes that isn't shared boilerplate. */
export function firstRealNote(notes: string): string | null {
  return (
    notes
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l !== '' && !isPinSourceNote(l)) ?? null
  );
}
