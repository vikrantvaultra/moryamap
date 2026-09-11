/**
 * Apply the press-verified mandal dataset (src/db/press-mandals.json):
 *   npx tsx scripts/import-press.ts
 *
 *  - inserts the sourced new mandals (idempotent; skips existing slugs)
 *  - applies sourced corrections to existing rows
 *  - clears any UNVERIFIED idol pin it is about to re-derive
 *  - geocodes each stated venue via Nominatim, accepting a result only when
 *    it genuinely matches the venue name (mustMatch token) inside the
 *    Mumbai/Navi Mumbai/Thane bounding box → APPROXIMATE mandal-location
 *    pins, recorded with full provenance in src/db/geocoded-pins.json
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { mandals, queues, type Tier } from '../src/db/schema';

const BOUNDS = { minLat: 18.85, maxLat: 19.35, minLng: 72.7, maxLng: 73.15 };
const VIEWBOX = `${BOUNDS.minLng},${BOUNDS.maxLat},${BOUNDS.maxLng},${BOUNDS.minLat}`;
const UA = 'MoryaMap/1.0 (Ganeshotsav queue info)';
const BASE_BY_TIER: Record<Tier, number> = { s: 240, a: 90, b: 35, c: 10 };

interface Venue {
  query: string;
  mustMatch: string;
}
interface PressMandal {
  slug: string;
  name: string;
  nameMr: string;
  nameHi: string;
  area: string;
  tier: Tier;
  nearestStation: string;
  notes: string;
  venue: Venue | null;
  sources: string[];
}
interface Dataset {
  corrections: { slug: string; area?: string; nearestStation?: string; source: string }[];
  mandals: PressMandal[];
  venuePinsForExisting: (Venue & { slug: string; venueSource: string })[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(v: Venue): Promise<{ lat: number; lng: number; display: string } | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5' +
    `&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(v.query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  await sleep(1100); // Nominatim usage policy
  if (!res.ok) return null;
  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const hit = results.find((r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    return (
      lat >= BOUNDS.minLat &&
      lat <= BOUNDS.maxLat &&
      lng >= BOUNDS.minLng &&
      lng <= BOUNDS.maxLng &&
      norm(r.display_name).includes(norm(v.mustMatch))
    );
  });
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), display: hit.display_name } : null;
}

async function main() {
  const db = getDb();
  const data = JSON.parse(
    readFileSync(join(__dirname, '..', 'src', 'db', 'press-mandals.json'), 'utf8'),
  ) as Dataset;

  const pinsFile = join(__dirname, '..', 'src', 'db', 'geocoded-pins.json');
  const pins: Record<string, unknown>[] = existsSync(pinsFile)
    ? JSON.parse(readFileSync(pinsFile, 'utf8'))
    : [];

  // 1. Corrections
  for (const c of data.corrections) {
    const patch: Record<string, string> = {};
    if (c.area) patch.area = c.area;
    if (c.nearestStation) patch.nearestStation = c.nearestStation;
    await db.update(mandals).set(patch).where(eq(mandals.slug, c.slug));
    console.log(`corrected ${c.slug}: ${JSON.stringify(patch)} (source: ${c.source})`);
  }

  // 2. New mandals
  for (const m of data.mandals) {
    const existing = await db.select({ id: mandals.id }).from(mandals).where(eq(mandals.slug, m.slug));
    if (existing.length > 0) {
      console.log(`exists: ${m.slug}`);
      continue;
    }
    const [row] = await db
      .insert(mandals)
      .values({
        slug: m.slug,
        name: m.name,
        nameMr: m.nameMr,
        nameHi: m.nameHi,
        area: m.area,
        tier: m.tier,
        nearestStation: m.nearestStation,
        notes: m.notes,
      })
      .returning();
    await db.insert(queues).values({
      mandalId: row.id,
      kind: 'general',
      label: 'Darshan',
      labelMr: 'दर्शन',
      baseMinutes: BASE_BY_TIER[m.tier],
    });
    console.log(`inserted: ${m.slug}`);
  }

  // 3. Venue pins (new mandals with a stated venue + existing mandals)
  const venueJobs: (Venue & { slug: string; venueSource: string })[] = [
    ...data.mandals
      .filter((m) => m.venue)
      .map((m) => ({ ...m.venue!, slug: m.slug, venueSource: m.sources[0] })),
    ...data.venuePinsForExisting,
  ];

  for (const job of venueJobs) {
    // Clear any pin we're about to re-derive so an unverified value can't linger.
    await db.update(mandals).set({ idolLat: null, idolLng: null }).where(eq(mandals.slug, job.slug));

    const hit = await geocode(job);
    if (!hit) {
      console.log(`no venue match (${job.slug} stays unpinned): "${job.query}"`);
      continue;
    }
    await db
      .update(mandals)
      .set({ idolLat: hit.lat, idolLng: hit.lng })
      .where(eq(mandals.slug, job.slug));
    const entry = {
      slug: job.slug,
      lat: hit.lat,
      lng: hit.lng,
      source: 'venue geocode (OSM/Nominatim)',
      venueQuery: job.query,
      venueSource: job.venueSource,
      osmDisplayName: hit.display,
      fetchedAt: new Date().toISOString(),
    };
    const i = pins.findIndex((p) => (p as { slug: string }).slug === job.slug);
    if (i >= 0) pins[i] = entry;
    else pins.push(entry);
    console.log(`pinned ${job.slug} → ${hit.lat.toFixed(5)},${hit.lng.toFixed(5)}`);
    console.log(`   ${hit.display}`);
  }

  writeFileSync(pinsFile, JSON.stringify(pins, null, 2) + '\n');
  console.log('\nDone. Review every ≈ pin in /admin.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
