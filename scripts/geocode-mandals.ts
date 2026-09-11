/**
 * Geocode mandal LOCATIONS (idolLat/idolLng) from OpenStreetMap via
 * Nominatim. Run with: npx tsx scripts/geocode-mandals.ts
 *
 * Honesty rules:
 *  - This sets the APPROXIMATE mandal location only — never queue entry
 *    pins. The UI renders these as distinct "≈ approximate" markers.
 *  - A result is accepted only when its OSM display name actually matches
 *    the mandal's name (normalized token match) AND it falls inside the
 *    Mumbai/Thane bounding box. No match → the mandal simply stays unpinned.
 *  - Accepted results are written to src/db/geocoded-pins.json with their
 *    full OSM display names so a human can review every single pin, and
 *    correct or clear it in /admin.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { mandals } from '../src/db/schema';

const BOUNDS = { minLat: 18.85, maxLat: 19.35, minLng: 72.7, maxLng: 73.15 };
const VIEWBOX = `${BOUNDS.minLng},${BOUNDS.maxLat},${BOUNDS.maxLng},${BOUNDS.minLat}`;
const UA = 'MoryaMap/1.0 (Ganeshotsav queue info; github.com/moryamap)';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  importance: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]/g, '');

/** Distinctive tokens a matching OSM name must contain. */
function candidates(name: string): string[] {
  const outside = name.replace(/\(.*?\)/g, ' ');
  const inside = /\((.*?)\)/.exec(name)?.[1] ?? '';
  return [norm(name), norm(outside), norm(inside)].filter((c) => c.length >= 6);
}

async function query(q: string): Promise<NominatimResult[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5' +
    `&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  return (await res.json()) as NominatimResult[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = getDb();
  const rows = await db.select().from(mandals);
  const accepted: {
    slug: string;
    lat: number;
    lng: number;
    source: string;
    osmDisplayName: string;
    fetchedAt: string;
  }[] = [];
  const misses: string[] = [];

  for (const m of rows) {
    if (m.idolLat != null && m.idolLng != null) {
      console.log(`skip (already pinned): ${m.slug}`);
      continue;
    }
    const city = m.area === 'Thane' ? 'Thane' : 'Mumbai';
    const cands = candidates(m.name);

    let hit: NominatimResult | null = null;
    for (const q of [`${m.name}, ${city}`, m.name]) {
      const results = await query(q);
      await sleep(1100); // Nominatim usage policy: max 1 req/sec
      hit =
        results.find((r) => {
          const lat = Number(r.lat);
          const lng = Number(r.lon);
          const inBounds =
            lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;
          const nameMatch = cands.some((c) => norm(r.display_name).includes(c));
          return inBounds && nameMatch;
        }) ?? null;
      if (hit) break;
    }

    if (!hit) {
      misses.push(m.slug);
      console.log(`NO MATCH (stays unpinned): ${m.name}`);
      continue;
    }

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    accepted.push({
      slug: m.slug,
      lat,
      lng,
      source: 'OSM/Nominatim',
      osmDisplayName: hit.display_name,
      fetchedAt: new Date().toISOString(),
    });
    await db.update(mandals).set({ idolLat: lat, idolLng: lng }).where(eq(mandals.id, m.id));
    console.log(`pinned ${m.slug} → ${lat.toFixed(5)},${lng.toFixed(5)}`);
    console.log(`   OSM: ${hit.display_name}`);
  }

  const out = join(__dirname, '..', 'src', 'db', 'geocoded-pins.json');
  writeFileSync(out, JSON.stringify(accepted, null, 2) + '\n');
  console.log(`\n${accepted.length} pinned, ${misses.length} unmatched: ${misses.join(', ') || '—'}`);
  console.log(`Review each pin in /admin. Written to ${out}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
