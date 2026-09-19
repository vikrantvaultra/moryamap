/**
 * Look for Ganeshotsav mandals in OpenStreetMap that the directory doesn't
 * have yet — run with:
 *
 *   npx tsx scripts/osm-mandals.ts
 *
 * It prints candidates; it writes nothing. Promoting one into
 * src/db/osm-mandals.json is a human decision, because OSM is full of
 * things that merely carry a mandal's name — schools, hospitals, housing
 * societies, sweet shops — and full of permanent Ganpati temples, which are
 * not sarvajanik utsav mandals.
 *
 * Read this before you get your hopes up: OSM is NOT a route to the full
 * Mumbai mandal list. Checked again on 19 Sep 2026, the whole MMR bounding
 * box yields ~440 features whose name mentions Ganesh/Ganpati/mandal, of
 * which about a dozen are actual utsav mandals. See the coverage section of
 * src/db/community-mandals.README.md for the sources that would move the
 * number, all of which need a human (RTI, ward office, BGSS).
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MandalData } from '../src/lib/queries';

const DB = join(__dirname, '..', 'src', 'db');
const UA = 'MoryaMap/1.0 (Ganeshotsav directory; github.com/moryamap)';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const BBOX = '18.85,72.70,19.40,73.20';

const QUERY = `[out:json][timeout:180];
(
  nwr["name"~"[Mm]andal|[Mm]andali|मंडळ|[Gg]aneshotsav|[Gg]anesh Utsav"](${BBOX});
  nwr["name"~"cha Raja|Cha Raja|chya Raja|[Mm]aharaja"](${BBOX});
);
out center tags;`;

/** Named after a mandal, but plainly not the mandal. */
const NOT_A_MANDAL =
  /school|college|vidyalaya|polytechnic|hospital|clinic|dispensary|pharmacy|nursing|store|stores|market|restaurant|cafe|hotel|food|agarbatti|jewell|realty|consult|bank|library|vachnalaya|crematorium|metro|depot|playground|cricket ground|gym|park mandala|society|\bchs\b|apartment|marg|road\b|\brd\b|statue|chowk|chok|bus stop/i;

/** Too generic to be findable — the same trap the community dataset fell into. */
const GENERIC = /^(shree |shri |sri )?(ganesh|ganpati|ganapati)( mandal| mandir| temple)?$/i;

interface Element {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  const dir = JSON.parse(readFileSync(join(DB, 'static-directory.json'), 'utf8')) as MandalData[];
  const known = new Set<string>();
  for (const m of dir) {
    known.add(norm(m.name));
    for (const a of m.aliases ?? []) known.add(norm(a));
  }

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`);
  const { elements } = (await res.json()) as { elements: Element[] };

  const seen = new Set<string>();
  const candidates: string[] = [];
  let rejected = 0;

  for (const el of elements) {
    const name = el.tags?.name?.trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;
    if (NOT_A_MANDAL.test(name) || GENERIC.test(name)) {
      rejected++;
      continue;
    }
    const key = norm(name);
    if (known.has(key) || seen.has(key)) {
      rejected++;
      continue;
    }
    seen.add(key);
    const kind = el.tags!.amenity ?? el.tags!.building ?? el.tags!.leisure ?? '—';
    candidates.push(`${name}\n    ${el.type}/${el.id}  ${lat},${lng}  [${kind}]`);
  }

  candidates.sort();
  console.log(`${elements.length} OSM features matched the name patterns.`);
  console.log(`${rejected} filtered out (already in the directory, generic, or not a mandal).`);
  console.log(`\n${candidates.length} candidates to review by hand:\n`);
  candidates.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${c}\n`));
  console.log('Promote the real ones into src/db/osm-mandals.json, then rebuild the directory.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
