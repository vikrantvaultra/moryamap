/**
 * Scrape the public Ganeshotsav directories for mandals this site doesn't
 * have yet — run with:
 *
 *   npx tsx scripts/scrape-mandals.ts
 *
 * Writes src/db/scraped-mandals.json, which scripts/build-directory.ts
 * merges into the directory. Nothing here is committed without a rerun, so
 * the file is always reproducible from these two sources.
 *
 * Sources (both serve a public JSON API and both allow crawling in
 * robots.txt; checked 19 Sep 2026):
 *
 *   bappagram.com          /api/v1/search/index — name, area, lat/lng
 *                          /api/v1/mandals      — address, मराठी name, year
 *   mumbaiganpatipandals.in
 *                          its Prismic CMS (mumbai-pandals.cdn.prismic.io)
 *                          — name, locality, nearest station and a Google
 *                          Maps short link per pandal. The short link is
 *                          followed once for its 302, whose URL carries the
 *                          coordinate the publisher pinned.
 *
 * Honesty handling, same rules as the rest of the directory:
 *  - A scraped coordinate is the publisher's pin for the MANDAL. It is not
 *    ground-verified by us and it is never a queue start, so every row
 *    ships at 'street' precision with a note naming the source.
 *  - Rows outside the Mumbai bounding box are dropped, not stretched: both
 *    sources carry Pune, Kolhapur and Belagavi entries, and one row sat in
 *    Kanpur.
 *  - Rows that duplicate something already in the directory — by name, by
 *    alias, or by sitting within 60 m of it under a similar name — are
 *    dropped and logged rather than merged blindly.
 *  - A row with no coordinate is dropped. The directory's contract is that
 *    everything in the list is on the map.
 *
 * Licensing: the Prismic coordinates originate from Google Maps links the
 * publisher chose to publish. That is the same caveat recorded for the
 * community dataset in src/db/community-mandals.README.md — re-deriving
 * these pins from OpenStreetMap is the clean long-term fix.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MandalData } from '../src/lib/queries';

const DB = join(__dirname, '..', 'src', 'db');
const UA = 'MoryaMap/1.0 (Ganeshotsav directory; github.com/moryamap)';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BOUNDS = { minLat: 18.85, maxLat: 19.35, minLng: 72.7, maxLng: 73.15 };

export interface ScrapedMandal {
  name: string;
  nameMr: string | null;
  aliases: string[];
  area: string;
  address: string | null;
  nearestStation: string | null;
  establishedYear: number | null;
  lat: number;
  lng: number;
  source: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Metres between two coordinates — equirectangular is plenty at this scale. */
function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const x = ((bLng - aLng) * Math.PI) / 180 * Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);
  const y = ((bLat - aLat) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

const STOPWORDS = new Set([
  'sarvajanik', 'ganeshotsav', 'ganesh', 'ganpati', 'utsav', 'mandal', 'mitra',
  'shree', 'shri', 'sri', 'cha', 'chi', 'the', 'mumbai', 'seva', 'samiti',
]);

/** Distinctive lowercase tokens of a name, stopwords removed. */
function tokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

const sameSet = (a: Set<string>, b: Set<string>) =>
  a.size > 0 && a.size === b.size && [...a].every((t) => b.has(t));

/**
 * Same mandal under a different write-up?
 *
 * Two tests, both deliberately strict. Substring matching was tried and
 * thrown out: it folded "Navi Mumbai Cha Raja Shiv Chaya Mitra Mandal
 * Turbhe" into "Mumbaicha Raja" and "Santosh Nagar Marketcha Raja" into
 * "Market Cha Raja", because the shorter name is literally inside the
 * longer one. In a city with nine mandals in one Khetwadi lane, a wrong
 * merge silently deletes a real mandal — worse than listing one twice.
 *
 *  1. The distinctive tokens match exactly. Stopwords like "sarvajanik"
 *     and "ganeshotsav" are stripped first, so "Lalbaugcha Raja" and
 *     "Lalbaugcha Raja Sarvajanik Ganeshotsav" agree, while "Khetwadicha
 *     Raja" and "Khetwadicha Maharaja" stay apart — they are two mandals.
 *  2. Or the pins are within 60 m and the names share most of their
 *     distinctive tokens, which catches one pandal filed under its popular
 *     name in one directory and its registered name in the other.
 */
function sameMandal(
  a: { name: string; aliases?: string[]; lat: number | null; lng: number | null },
  b: { name: string; aliases?: string[]; lat: number | null; lng: number | null },
): boolean {
  const an = [a.name, ...(a.aliases ?? [])];
  const bn = [b.name, ...(b.aliases ?? [])];
  if (an.map(norm).some((x) => bn.map(norm).includes(x))) return true;
  for (const x of an) {
    for (const y of bn) {
      if (sameSet(tokens(x), tokens(y))) return true;
    }
  }
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false;
  if (metres(a.lat, a.lng, b.lat, b.lng) > 60) return false;
  const [ta, tb] = [tokens(a.name), tokens(b.name)];
  if (ta.size === 0 || tb.size === 0) return false;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / Math.min(ta.size, tb.size) >= 0.5;
}

const inMumbai = (lat: number, lng: number) =>
  lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

/**
 * Keep an address only when it is one. Both sources mostly put a locality
 * in the address field — "Malad West", "Mumbai Metropolitan Region" —
 * which repeats `area`, tells a visitor nothing, and collides with every
 * other mandal in that locality. A real address names a street.
 */
const STREET_TOKEN =
  /\d|road|\brd\b|marg|lane|\bln\b|galli|gully|path|chowk|cross|nagar|wadi\b|chawl|compound|opp\.|near|behind|sector/i;

function usefulAddress(address: string | null | undefined, area: string): string | null {
  const clean = (address ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (norm(clean) === norm(area)) return null;
  if (!STREET_TOKEN.test(clean)) return null;
  // "Malad West, Mumbai" is still just the locality with a city bolted on.
  const withoutCity = clean.replace(/,?\s*(mumbai|maharashtra|india)\b.*$/i, '').trim();
  if (!withoutCity || norm(withoutCity) === norm(area)) return null;
  return clean;
}

/** Title Case for sources that shout ("BHOIWADA CHA RAJA"). */
function titleCase(s: string): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean !== clean.toUpperCase()) return clean;
  return clean
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bCha\b/g, 'cha')
    .replace(/\bChi\b/g, 'chi');
}

async function json<T>(url: string, ua = UA): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

// --- Source 1: bappagram.com ------------------------------------------

interface BappaIndexRow {
  slug: string;
  name: string;
  nameMr: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface BappaDetail {
  slug: string;
  name: string;
  nameMr: string | null;
  nameHi: string | null;
  address: string | null;
  area: string | null;
  establishedYear: number | null;
}

async function fromBappagram(): Promise<ScrapedMandal[]> {
  const index = await json<BappaIndexRow[]>('https://bappagram.com/api/v1/search/index');
  const detail = new Map<string, BappaDetail>();
  for (let page = 1; page <= 20; page++) {
    const body = await json<{ data: BappaDetail[] }>(
      `https://bappagram.com/api/v1/mandals?page=${page}`,
    );
    const rows = body.data ?? [];
    rows.forEach((m) => detail.set(m.slug, m));
    if (rows.length === 0) break;
    await sleep(300);
  }
  console.log(`  bappagram: ${index.length} indexed, ${detail.size} with detail`);

  const out: ScrapedMandal[] = [];
  let dropped = 0;
  for (const row of index) {
    if (row.latitude == null || row.longitude == null || !inMumbai(row.latitude, row.longitude)) {
      dropped++;
      continue;
    }
    const d = detail.get(row.slug);
    const area = titleCase(d?.area ?? row.area ?? '').trim() || 'Mumbai';
    out.push({
      name: titleCase(row.name),
      nameMr: (d?.nameMr ?? row.nameMr)?.trim() || null,
      aliases: [],
      area,
      address: usefulAddress(d?.address, area),
      nearestStation: null,
      establishedYear: d?.establishedYear ?? null,
      lat: row.latitude,
      lng: row.longitude,
      source: `bappagram.com/mandal/${row.slug}`,
    });
  }
  console.log(`  bappagram: ${out.length} in Mumbai, ${dropped} outside or unpinned`);
  return out;
}

// --- Source 2: mumbaiganpatipandals.in (Prismic) -----------------------

interface PrismicDoc {
  uid: string;
  data: {
    header?: string;
    location?: string;
    station?: string;
    address?: { text?: string }[];
    gmap_link?: string | null;
  };
}

/**
 * Follow the Google Maps short link once and read the 302's coordinate.
 * Results are cached in the OS temp dir: reruns while tuning the merge
 * rules shouldn't hammer a redirector 221 times over.
 */
const CACHE_FILE = join(tmpdir(), 'moryamap-gmap-links.json');
const linkCache: Record<string, { lat: number; lng: number } | null> = existsSync(CACHE_FILE)
  ? JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  : {};

async function resolveMapLink(link: string): Promise<{ lat: number; lng: number } | null> {
  if (link in linkCache) return linkCache[link];
  const res = await fetch(link, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'manual' });
  const location = res.headers.get('location') ?? '';
  const m =
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(location) ?? /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(location);
  const pin = m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  linkCache[link] = pin;
  writeFileSync(CACHE_FILE, JSON.stringify(linkCache));
  return pin;
}

async function fromPrismic(): Promise<ScrapedMandal[]> {
  const api = await json<{ refs: { ref: string }[] }>(
    'https://mumbai-pandals.cdn.prismic.io/api/v2',
  );
  const ref = api.refs[0].ref;
  const docs: PrismicDoc[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = new URL('https://mumbai-pandals.cdn.prismic.io/api/v2/documents/search');
    url.searchParams.set('ref', ref);
    url.searchParams.set('q', '[[at(document.type,"pandal")]]');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('page', String(page));
    const body = await json<{ results: PrismicDoc[]; total_pages: number }>(url.toString());
    docs.push(...body.results);
    if (page >= body.total_pages) break;
    await sleep(300);
  }
  console.log(`  mumbaiganpatipandals.in: ${docs.length} pandals`);

  const out: ScrapedMandal[] = [];
  let unresolved = 0;
  let outside = 0;
  for (const [i, doc] of docs.entries()) {
    const name = titleCase(doc.data.header ?? '');
    const link = doc.data.gmap_link;
    if (!name || !link) {
      unresolved++;
      continue;
    }
    const cached = link in linkCache;
    const pin = await resolveMapLink(link).catch(() => null);
    if (!cached) await sleep(350); // one redirect every ~third of a second, no more
    if (!pin) {
      unresolved++;
      continue;
    }
    if (!inMumbai(pin.lat, pin.lng)) {
      outside++;
      continue;
    }
    const area = titleCase(doc.data.location ?? '') || 'Mumbai';
    out.push({
      name,
      nameMr: null,
      aliases: [],
      area,
      address: usefulAddress(
        (doc.data.address ?? []).map((b) => b.text).filter(Boolean).join(', '),
        area,
      ),
      nearestStation: titleCase(doc.data.station ?? '') || null,
      establishedYear: null,
      lat: pin.lat,
      lng: pin.lng,
      source: `mumbaiganpatipandals.in/pandal/${doc.uid}`,
    });
    if ((i + 1) % 50 === 0) console.log(`    resolved ${i + 1}/${docs.length}`);
  }
  console.log(
    `  mumbaiganpatipandals.in: ${out.length} in Mumbai, ${unresolved} unpinned, ${outside} outside`,
  );
  return out;
}

// --- merge -------------------------------------------------------------

async function main() {
  console.log('Scraping public Ganeshotsav directories…');
  const bappa = await fromBappagram();
  const prismic = await fromPrismic();

  const directory = JSON.parse(readFileSync(join(DB, 'static-directory.json'), 'utf8')) as MandalData[];
  const existing = directory.map((m) => ({
    name: m.name,
    aliases: m.aliases,
    lat: m.idolLat,
    lng: m.idolLng,
  }));

  const kept: ScrapedMandal[] = [];
  const skipped: string[] = [];
  // bappagram first: it carries addresses and मराठी names more often.
  for (const row of [...bappa, ...prismic]) {
    const hit = existing.find((e) => sameMandal(e, row));
    if (hit) {
      skipped.push(`${row.name} → already in the directory as ${hit.name}`);
      continue;
    }
    const dup = kept.find((k) => sameMandal(k, row));
    if (dup) {
      // Keep the richer row and remember the other spelling for search.
      if (!dup.aliases.includes(row.name) && norm(dup.name) !== norm(row.name)) {
        dup.aliases.push(row.name);
      }
      dup.nameMr ??= row.nameMr;
      dup.address ??= row.address;
      dup.nearestStation ??= row.nearestStation;
      dup.establishedYear ??= row.establishedYear;
      skipped.push(`${row.name} → merged into ${dup.name}`);
      continue;
    }
    kept.push(row);
  }

  kept.sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
  writeFileSync(
    join(DB, 'scraped-mandals.json'),
    JSON.stringify(
      {
        _comment:
          'Generated by scripts/scrape-mandals.ts — do not hand-edit. Public directories scraped for mandals missing from this one; see the script header for sources, honesty rules and the licensing caveat.',
        fetchedAt: new Date().toISOString().slice(0, 10),
        mandals: kept,
      },
      null,
      2,
    ) + '\n',
  );

  console.log(`\n${kept.length} new mandals written to src/db/scraped-mandals.json`);
  console.log(`${skipped.length} skipped:\n  ${skipped.slice(0, 40).join('\n  ')}`);
  if (skipped.length > 40) console.log(`  … and ${skipped.length - 40} more`);
  console.log(`\nDirectory goes from ${directory.length} to ${directory.length + kept.length}.`);
  console.log('Next: npx tsx scripts/build-directory.ts && npx tsx scripts/assign-wards.ts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
