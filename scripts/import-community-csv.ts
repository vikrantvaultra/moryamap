/**
 * Apply the community-compiled mandal list (src/db/community-mandals.csv,
 * columns: mandal_name,address,latitude,longitude,source) to the HARDCODED
 * directory — no database involved:
 *   - src/db/static-directory.json   (what the site serves)
 *   - src/db/geocoded-pins.json      (provenance for every pin it sets)
 *
 *   npx tsx scripts/import-community-csv.ts [path/to/file.csv]
 *
 * Honesty handling:
 *  - pins are APPROXIMATE mandal locations (≈ markers), never queue starts
 *  - an existing pin with recorded provenance is never overwritten
 *  - pins are marked pinPrecision 'area' when the source only knows the
 *    locality (area centroid, round-number coords, locality-only address,
 *    or coordinates copied from a different address) so the UI says so
 *  - rows that are the same mandal as an existing entry (or as another row)
 *    are merged, not duplicated — see MERGE_INTO / DUPLICATE_OF
 *  - the result is asserted unique (id, slug, name, address, pin) and every
 *    mandal must have a pin, so everything in the list is on the map
 *
 * Idempotent: re-running updates the same rows.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv, slugify } from '../src/lib/csv';
import { directoryProblems } from '../src/lib/directory-check';
import type { Tier } from '../src/db/schema';
import type { MandalData, PinPrecision } from '../src/lib/queries';

const ROOT = join(__dirname, '..');
const STATIC_FILE = join(ROOT, 'src', 'db', 'static-directory.json');
const PINS_FILE = join(ROOT, 'src', 'db', 'geocoded-pins.json');
const DEFAULT_CSV = join(ROOT, 'src', 'db', 'community-mandals.csv');

const BASE_BY_TIER: Record<Tier, number> = { s: 240, a: 90, b: 35, c: 10 };
const BOUNDS = { minLat: 18.85, maxLat: 19.35, minLng: 72.7, maxLng: 73.15 };

/** CSV row name → existing directory slug (same mandal, or its organising body). */
const MERGE_INTO: Record<string, string> = {
  'Lalbaugcha Raja Sarvajanik Ganeshotsav Mandal': 'lalbaugcha-raja',
  'Mumbai Cha Raja': 'mumbaicha-raja',
  'Lalbaug Sarvajanik Utsav Mandal': 'mumbaicha-raja', // organiser of Mumbaicha Raja, Ganesh Galli
  'GSB Seva Mandal': 'gsb-seva-mandal',
  'Andhericha Raja': 'andhericha-raja',
  'Azad Nagar Sarvajanik Utsav Samiti': 'andhericha-raja', // organiser of Andhericha Raja
  'Azad Nagar Sarvajanik Ganeshotsav Mandal': 'andhericha-raja',
  'Khetwadicha Ganraj': 'khetwadicha-ganraj',
  'Girgaoncha Raja Shree Ganeshotsav Mandal': 'girgaoncha-raja',
  'Chinchpoklicha Chintamani': 'chinchpoklicha-chintamani',
  'Tejukayacha Raja': 'tejukaya',
  'Parelcha Raja': 'parel-cha-raja',
  'Sahyadri Krida Mandal': 'sahyadri-krida-mandal',
  'Sahyadri Krida Mandal Tilak Nagar': 'sahyadri-krida-mandal',
  'Dongri Cha Raja': 'dongri-cha-raja',
  'Dongri Sarvajanik Ganeshotsav Mandal': 'dongri-cha-raja', // organiser, same spot
  'Keshavji Naik Chawl Sarvajanik Ganeshotsav Mandal': 'keshavji-naik-chawl',
  // Fort Vibhag Sarvajanik Ganeshotsav Mandal, opposite GPO (fortchaicchapurtiganesh.com)
  'Fortcha Icchapurti Raja': 'fort-cha-raja',
};

/** CSV row name → earlier CSV row name it duplicates (same place, same mandal). */
const DUPLICATE_OF: Record<string, string> = {
  'Juhu Koliwada Sarvajanik Ganeshotsav Mandal': 'Juhu Koliwada Ganeshotsav Mandal',
  'Star Boys Mitra Mandal': 'Sion Koliwada Star Boys Mitra Mandal',
  'Bal Gopal Mitra Mandal': 'Parel Sarvajanik Ganeshotsav Bal Gopal Mandal',
  'Dadar Sarvajanik Ganeshotsav Mandal': 'Dadar TT Sarvajanik Ganeshotsav Mandal',
  'Grant Road Sarvajanik Ganeshotsav Mandal': 'Grant Road Cha Raja Sarvajanik Ganesh Utsav Mandal',
  // Generic locality listings at the same address/spot as a specifically named row:
  'Khar Sarvajanik Ganeshotsav Mandal': 'Khar West Sarvajanik Ganeshotsav Mandal',
  'Malad Sarvajanik Ganeshotsav Mandal': 'Malad West Sarvajanik Ganeshotsav Mandal',
  'Bandra Sarvajanik Ganeshotsav Mandal': 'Bandra West Sarvajanik Ganeshotsav Mandal',
  'Kandivali East Sarvajanik Ganeshotsav Mandal': 'Thakur Village Sarvajanik Ganeshotsav Mandal',
  'Sion Koliwada Sarvajanik Ganeshotsav Mandal': 'Sion Koliwada Star Boys Mitra Mandal',
  'Vikhroli Sarvajanik Ganeshotsav Mandal': 'Vikhroli Balmitra Kala Mandal',
  'Koldongri Sarvajanik Ganeshotsav Mandal': 'Andheri Cha Morya',
  'Jogeshwari East Sarvajanik Ganeshotsav Mandal': 'Pratap Nagar Sarvajanik Ganeshotsav Mandal',
};

interface LocationFix {
  lat: number;
  lng: number;
  precision: PinPrecision;
  source: string;
  address?: string;
}

/**
 * Pins the CSV got wrong (coordinates copied from another row, or 600 m off)
 * — replaced with OSM/Nominatim lookups of the stated venue, fetched 13 Sep 2026.
 */
const CSV_LOCATION_FIX: Record<string, LocationFix> = {
  'Fortcha Icchapurti Raja': {
    lat: 18.9399723,
    lng: 72.8343386,
    precision: 'area',
    source: 'OSM/Nominatim: General Post Office (GPO), Fort — mandal is opposite GPO',
    address:
      'Icchapurti Ganesh Chowk, Dr Sundarlal Bahal Path (Goa Street), opposite GPO, Fort, Mumbai, Maharashtra 400001',
  },
  'Sarvajanik Bal Ganesh Utsav Mandal': {
    lat: 19.1301942,
    lng: 72.8493879,
    precision: 'street',
    source: 'OSM/Nominatim: Saraswati Baug, Hindu Friends Society Marg',
  },
  'Thakurdwar Sarvajanik Ganeshotsav Mandal': {
    lat: 18.9500139,
    lng: 72.8236381,
    precision: 'area',
    source: 'OSM/Nominatim: Thakurdwar locality',
  },
  'Trombay Sarvajanik Ganeshotsav Mandal': {
    lat: 19.033651,
    lng: 72.9503637,
    precision: 'area',
    source: 'OSM/Nominatim: Trombay Koliwada',
  },
};

/**
 * Directory mandals the CSV doesn't cover, with no public street address.
 * Neighbourhood-level pins (OSM/Nominatim, 13 Sep 2026) so they still appear
 * on the map — clearly labelled as neighbourhood-only.
 */
const AREA_PINS_FOR_EXISTING: Record<string, LocationFix> = {
  'dadar-cha-raja': {
    lat: 19.0192269,
    lng: 72.8428479,
    precision: 'area',
    source: 'OSM/Nominatim: Dadar station area',
  },
  'borivali-cha-raja': {
    lat: 19.2313925,
    lng: 72.8408607,
    precision: 'area',
    source: 'OSM/Nominatim: Borivali (West) station area',
  },
  'ghatkoparcha-raja': {
    lat: 19.0833438,
    lng: 72.9123246,
    precision: 'area',
    source: 'OSM/Nominatim: Ghatkopar East suburb centre',
  },
  'vashicha-raja': {
    lat: 19.075784,
    lng: 72.9952364,
    precision: 'area',
    source: 'OSM/Nominatim: Vashi suburb centre (sources disagree: Sector 1 vs Sector 8)',
  },
};

/** Named, well-known mandals get the 'popular' baseline; generic listings 'neighbourhood'. */
const POPULAR = /raja|ganraj|morya|peshwa|vighnesh|chintamani|mumbai cha shree|gsb|chandanwadi|jitekar|tulshiwadi/i;

/** A street/building-level token in the address → the pin is at least street-level. */
const STREET_TOKEN =
  /\d|road|marg|lane|galli|path|chowk|nivas|mansion|bhavan|park|complex|colony|society|subway|talao|chawl|garden|wadi\b/i;

interface CsvRow {
  name: string;
  address: string;
  lat: number;
  lng: number;
  source: string;
}

function decimals(n: number): number {
  const s = String(n);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

/** Locality = the last address part before "Mumbai". */
function localityOf(address: string): string {
  const parts = address.split(',').map((p) => p.trim());
  const i = parts.findIndex((p) => p === 'Mumbai');
  return i > 0 ? parts[i - 1] : parts[0];
}

function precisionOf(row: CsvRow, coordsReused: boolean): PinPrecision {
  const beforeMumbai = row.address.split(',').map((p) => p.trim());
  const localityOnly = beforeMumbai.indexOf('Mumbai') <= 1;
  if (
    row.source === 'area_centroid_approx' ||
    coordsReused ||
    localityOnly ||
    (decimals(row.lat) <= 3 && decimals(row.lng) <= 3) ||
    !STREET_TOKEN.test(row.address.replace(/Mumbai, Maharashtra \d{6}$/, ''))
  ) {
    return 'area';
  }
  return 'street';
}

/** Existing mandals keep their notes; the pin caveat is appended once. */
function addNote(m: MandalData, precision: PinPrecision) {
  if (m.notes.includes(NOTE[precision])) return;
  m.notes = m.notes.trim() ? `${m.notes.trim()}\n\n${NOTE[precision]}` : NOTE[precision];
}

function assertDirectory(dir: MandalData[]) {
  const problems = directoryProblems(dir);
  if (problems.length) throw new Error(`Directory check failed:\n  ${problems.join('\n  ')}`);
}

const NOTE: Record<PinPrecision, string> = {
  street:
    'Map pin is approximate — taken from a community-compiled mandal list (map search), not verified on the ground. Confirm locally before you go.',
  area:
    'Map pin marks the neighbourhood only — the source list gives the locality, not the pandal’s exact spot. Ask locally for directions.',
};

async function main() {
  const file = process.argv[2] ?? DEFAULT_CSV;
  const rows: CsvRow[] = parseCsv(readFileSync(file, 'utf8')).map((r) => ({
    name: r.mandal_name,
    address: r.address,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    source: r.source,
  }));
  const fixSource = new Map<string, string>();
  for (const row of rows) {
    const fix = CSV_LOCATION_FIX[row.name];
    if (!fix) continue;
    row.lat = fix.lat;
    row.lng = fix.lng;
    row.address = fix.address ?? row.address;
    fixSource.set(row.name, fix.source);
  }

  const dir = JSON.parse(readFileSync(STATIC_FILE, 'utf8')) as MandalData[];
  const pins = JSON.parse(readFileSync(PINS_FILE, 'utf8')) as Record<string, unknown>[];
  const sourcedPins = new Set(pins.map((p) => p.slug as string));
  const bySlug = new Map(dir.map((m) => [m.slug, m]));
  const names = new Set(rows.map((r) => r.name));
  for (const [dup, of] of Object.entries(DUPLICATE_OF)) {
    if (!names.has(of)) throw new Error(`DUPLICATE_OF target missing from CSV: ${of} (for ${dup})`);
  }

  let nextMandalId = Math.max(...dir.map((m) => m.id)) + 1;
  let nextQueueId = Math.max(...dir.flatMap((m) => m.queues.map((q) => q.id))) + 1;
  const seenCoords = new Map<string, string>(); // "lat,lng" → first address
  const fetchedAt = new Date().toISOString();
  const log = { merged: [] as string[], added: [] as string[], skipped: [] as string[] };

  const recordPin = (slug: string, row: CsvRow, precision: PinPrecision) => {
    const entry = {
      slug,
      lat: row.lat,
      lng: row.lng,
      source: fixSource.get(row.name) ?? `community CSV (${row.source})`,
      precision,
      csvName: row.name,
      address: row.address,
      fetchedAt,
    };
    const i = pins.findIndex((p) => p.slug === slug);
    if (i >= 0) pins[i] = entry;
    else pins.push(entry);
    sourcedPins.add(slug);
  };

  for (const row of rows) {
    const valid =
      Number.isFinite(row.lat) &&
      Number.isFinite(row.lng) &&
      row.lat >= BOUNDS.minLat &&
      row.lat <= BOUNDS.maxLat &&
      row.lng >= BOUNDS.minLng &&
      row.lng <= BOUNDS.maxLng;
    if (!row.name || !valid) {
      log.skipped.push(`${row.name || '(no name)'} — missing name or coords outside Mumbai`);
      continue;
    }

    const key = `${row.lat},${row.lng}`;
    const firstAddress = seenCoords.get(key);
    const coordsReused = firstAddress != null && firstAddress !== row.address;
    if (firstAddress == null) seenCoords.set(key, row.address);
    const precision = CSV_LOCATION_FIX[row.name]?.precision ?? precisionOf(row, coordsReused);

    if (DUPLICATE_OF[row.name]) {
      log.skipped.push(`${row.name} — duplicate of "${DUPLICATE_OF[row.name]}"`);
      continue;
    }

    const mergeSlug = MERGE_INTO[row.name];
    if (mergeSlug) {
      const m = bySlug.get(mergeSlug);
      if (!m) throw new Error(`MERGE_INTO target not in directory: ${mergeSlug}`);
      // The first (most specific) CSV row for a mandal wins the address.
      if (!m.address) m.address = row.address;
      if (m.idolLat == null && !sourcedPins.has(mergeSlug)) {
        m.idolLat = row.lat;
        m.idolLng = row.lng;
        m.pinPrecision = precision;
        recordPin(mergeSlug, row, precision);
        addNote(m, precision);
        log.merged.push(`${row.name} → ${mergeSlug} (address + ${precision} pin)`);
      } else {
        log.merged.push(`${row.name} → ${mergeSlug} (address only; existing pin kept)`);
      }
      continue;
    }

    let slug = slugify(row.name);
    const existing = bySlug.get(slug);
    if (existing && !pins.some((p) => p.slug === slug && p.csvName === row.name)) {
      slug = `${slug}-${slugify(localityOf(row.address))}`.slice(0, 60);
    }
    const tier: Tier = POPULAR.test(row.name) ? 'b' : 'c';
    const prev = bySlug.get(slug);
    const mandal: MandalData = {
      id: prev?.id ?? nextMandalId++,
      slug,
      name: row.name,
      nameMr: prev?.nameMr ?? null,
      nameHi: prev?.nameHi ?? null,
      area: localityOf(row.address),
      tier,
      idolLat: row.lat,
      idolLng: row.lng,
      pinPrecision: precision,
      address: row.address,
      nearestStation: prev?.nearestStation ?? null,
      stationWalkMinutes: null,
      notes: NOTE[precision],
      queues: prev?.queues ?? [
        {
          id: nextQueueId++,
          kind: 'general',
          label: 'Darshan',
          labelMr: 'दर्शन',
          entryLat: null,
          entryLng: null,
          baseMinutes: BASE_BY_TIER[tier],
          entryPoints: [],
          report: null,
        },
      ],
    };
    if (prev) dir[dir.indexOf(prev)] = mandal;
    else dir.push(mandal);
    bySlug.set(slug, mandal);
    recordPin(slug, row, precision);
    log.added.push(`${slug} [${tier}, ${precision}] ${mandal.area}`);
  }

  for (const [slug, fix] of Object.entries(AREA_PINS_FOR_EXISTING)) {
    const m = bySlug.get(slug);
    if (!m) throw new Error(`AREA_PINS_FOR_EXISTING target not in directory: ${slug}`);
    if (m.idolLat != null) continue;
    m.idolLat = fix.lat;
    m.idolLng = fix.lng;
    m.pinPrecision = fix.precision;
    addNote(m, fix.precision);
    const entry = { slug, lat: fix.lat, lng: fix.lng, source: fix.source, precision: fix.precision, fetchedAt };
    const i = pins.findIndex((p) => p.slug === slug);
    if (i >= 0) pins[i] = entry;
    else pins.push(entry);
    log.merged.push(`${slug} (${fix.precision} pin: ${fix.source})`);
  }

  // Existing rows without the new fields get explicit nulls (stable JSON shape).
  for (const m of dir) {
    m.address ??= null;
    m.pinPrecision ??= null;
  }
  assertDirectory(dir);

  // Same order as fetchDirectory: area, then tier, then name. Never by wait.
  const TIER_ORDER: Record<Tier, number> = { s: 0, a: 1, b: 2, c: 3 };
  dir.sort(
    (a, b) =>
      a.area.localeCompare(b.area) ||
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      a.name.localeCompare(b.name),
  );

  writeFileSync(STATIC_FILE, JSON.stringify(dir, null, 2) + '\n');
  writeFileSync(PINS_FILE, JSON.stringify(pins, null, 2) + '\n');

  console.log(`Merged into existing (${log.merged.length}):\n  ${log.merged.join('\n  ')}`);
  console.log(`\nAdded (${log.added.length}):\n  ${log.added.join('\n  ')}`);
  console.log(`\nSkipped (${log.skipped.length}):\n  ${log.skipped.join('\n  ')}`);
  console.log(`\nStatic directory: ${dir.length} mandals, ${dir.filter((m) => m.idolLat != null).length} pinned.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
