/**
 * Export the mandal directory to src/db/static-directory.json — the bundled
 * fallback served when DATABASE_URL is not configured (e.g. a fresh Vercel
 * deploy before Neon exists).
 *
 * Sanitized on purpose:
 *  - queue entry pins, holding points, walk minutes and reports are STRIPPED
 *    (locally they may contain unverified dev/test values; queue starts are
 *    only ever set through /admin against a real database)
 *  - idol pins are kept ONLY for slugs present in geocoded-pins.json, i.e.
 *    locations with recorded OSM/press provenance
 *  - notes are kept only when non-test (drop anything containing "Test")
 *
 * Run: npx tsx scripts/export-static.ts   (then commit the JSON)
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchDirectory } from '../src/lib/queries';

async function main() {
  const pins = new Set(
    (
      JSON.parse(
        readFileSync(join(__dirname, '..', 'src', 'db', 'geocoded-pins.json'), 'utf8'),
      ) as { slug: string }[]
    ).map((p) => p.slug),
  );

  const dir = await fetchDirectory();
  const sanitized = dir.map((m) => ({
    ...m,
    idolLat: pins.has(m.slug) ? m.idolLat : null,
    idolLng: pins.has(m.slug) ? m.idolLng : null,
    stationWalkMinutes: null,
    notes: m.notes.includes('Test') ? '' : m.notes,
    queues: m.queues.map((q) => ({
      ...q,
      entryLat: null,
      entryLng: null,
      entryPoints: [],
      report: null,
    })),
  }));

  const out = join(__dirname, '..', 'src', 'db', 'static-directory.json');
  writeFileSync(out, JSON.stringify(sanitized, null, 2) + '\n');
  console.log(`Exported ${sanitized.length} mandals (${[...pins].length} sourced pins) → ${out}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
