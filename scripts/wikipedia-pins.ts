/**
 * Fill APPROXIMATE mandal locations (idolLat/idolLng) from the coordinates
 * published on each mandal's Wikipedia article. Run after seeding:
 *   npx tsx scripts/wikipedia-pins.ts
 *
 * Same honesty contract as geocode-mandals.ts: mandal location only (never
 * queue starts), sourced + reviewable (article title recorded in
 * src/db/geocoded-pins.json), UI renders these as "≈ approximate" markers,
 * and anything without a source simply stays unpinned for /admin.
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { mandals } from '../src/db/schema';

const BOUNDS = { minLat: 18.85, maxLat: 19.35, minLng: 72.7, maxLng: 73.15 };

/** Candidate en.wikipedia article titles per mandal slug. */
const CANDIDATES: Record<string, string[]> = {
  'lalbaugcha-raja': ['Lalbaugcha Raja'],
  'mumbaicha-raja': ['Mumbaicha Raja', 'Ganesh Galli'],
  'gsb-seva-mandal': ['GSB Seva Mandal', "GSB Seva Mandal King's Circle"],
  'andhericha-raja': ['Andhericha Raja'],
  'chinchpoklicha-chintamani': ['Chinchpoklicha Chintamani', 'Chinchpokli Cha Chintamani'],
  'khetwadicha-ganraj': ['Khetwadicha Ganraj', 'Khetwadi Ganraj'],
  tejukaya: ['Tejukaya Ganesh Mandal'],
  'girgaoncha-raja': ['Girgaoncha Raja'],
  'fort-cha-raja': ['Fort Cha Raja', 'Fortcha Raja'],
  'keshavji-naik-chawl': ['Keshavji Naik Chawl'],
  'sahyadri-krida-mandal': ['Sahyadri Krida Mandal'],
  'parel-cha-raja': ['Parel Cha Raja', 'Nare Park Ganesh Mandal'],
  'chembur-cha-raja': ['Chembur Cha Raja', 'Chemburcha Raja'],
  'borivali-cha-raja': ['Borivali Cha Raja', 'Borivalicha Raja'],
  'thane-cha-raja': ['Thane Cha Raja', 'Shree Kaupineshwar Ganeshotsav'],
};

interface WikiPage {
  title: string;
  coordinates?: { lat: number; lon: number }[];
  missing?: boolean;
}

async function coordsFor(titles: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1' +
    '&prop=coordinates&colimit=max&titles=' +
    encodeURIComponent(titles.join('|'));
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MoryaMap/1.0 (Ganeshotsav queue info)' },
  });
  const data = (await res.json()) as {
    query?: {
      redirects?: { from: string; to: string }[];
      pages?: Record<string, WikiPage>;
    };
  };
  const out = new Map<string, { lat: number; lng: number }>();
  const redirect = new Map((data.query?.redirects ?? []).map((r) => [r.to, r.from]));
  for (const page of Object.values(data.query?.pages ?? {})) {
    const c = page.coordinates?.[0];
    if (!c) continue;
    if (c.lat < BOUNDS.minLat || c.lat > BOUNDS.maxLat || c.lon < BOUNDS.minLng || c.lon > BOUNDS.maxLng)
      continue;
    out.set(page.title, { lat: c.lat, lng: c.lon });
    const from = redirect.get(page.title);
    if (from) out.set(from, { lat: c.lat, lng: c.lon });
  }
  return out;
}

async function main() {
  const db = getDb();
  const rows = await db.select().from(mandals);

  const allTitles = Object.values(CANDIDATES).flat();
  const found = await coordsFor(allTitles);

  const pinsFile = join(__dirname, '..', 'src', 'db', 'geocoded-pins.json');
  const existing: {
    slug: string;
    lat: number;
    lng: number;
    source: string;
    osmDisplayName?: string;
    wikipediaTitle?: string;
    fetchedAt: string;
  }[] = existsSync(pinsFile) ? JSON.parse(readFileSync(pinsFile, 'utf8')) : [];

  let pinned = 0;
  for (const m of rows) {
    if (m.idolLat != null && m.idolLng != null) continue;
    const titles = CANDIDATES[m.slug] ?? [m.name];
    const hitTitle = titles.find((t) => found.has(t));
    if (!hitTitle) {
      console.log(`no Wikipedia coordinates: ${m.name}`);
      continue;
    }
    const { lat, lng } = found.get(hitTitle)!;
    await db.update(mandals).set({ idolLat: lat, idolLng: lng }).where(eq(mandals.id, m.id));
    existing.push({
      slug: m.slug,
      lat,
      lng,
      source: 'Wikipedia',
      wikipediaTitle: hitTitle,
      fetchedAt: new Date().toISOString(),
    });
    pinned++;
    console.log(`pinned ${m.slug} → ${lat.toFixed(5)},${lng.toFixed(5)} (en.wikipedia: ${hitTitle})`);
  }

  writeFileSync(pinsFile, JSON.stringify(existing, null, 2) + '\n');
  console.log(`\n${pinned} newly pinned from Wikipedia. Review each in /admin.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
