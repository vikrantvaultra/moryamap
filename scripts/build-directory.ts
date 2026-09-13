/**
 * Build the HARDCODED mandal directory the site serves — no database:
 *
 *   npx tsx scripts/build-directory.ts
 *
 * Inputs
 *   src/db/curated-mandals.json   the 20 hand-curated mandals (names in
 *                                 मराठी/हिंदी, stations, tiers, queues, notes)
 *   src/db/curated-pins.json      provenance of their original OSM pins
 *   src/db/community-mandals.csv  the verified community dataset (13 Sep 2026;
 *                                 see community-mandals.README.md). Columns:
 *                                 mandal_name,also_known_as,area,address,
 *                                 latitude,longitude,place_id,coord_source,
 *                                 coord_precision,verification,qa_flag
 * Outputs
 *   src/db/static-directory.json  what the site serves
 *   src/db/geocoded-pins.json     provenance for every pin
 *
 * Honesty handling:
 *  - pins are mandal locations, never queue starts
 *  - pinPrecision: 'rooftop' (verified place), 'street' (unverified street
 *    address), 'area' (neighbourhood only) — the UI labels each
 *  - a row flagged by the dataset's QA is never pinned at its bad coordinate
 *  - the result must pass directoryProblems(): unique id/slug/name/address/
 *    pin, and every mandal pinned — so everything in the list is on the map
 *
 * IDs and slugs of mandals already in the directory are kept stable.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv, slugify } from '../src/lib/csv';
import { directoryProblems } from '../src/lib/directory-check';
import type { Tier } from '../src/db/schema';
import type { MandalData, PinPrecision } from '../src/lib/queries';

const DB = join(__dirname, '..', 'src', 'db');
const read = <T>(file: string): T => JSON.parse(readFileSync(join(DB, file), 'utf8')) as T;

const BASE_BY_TIER: Record<Tier, number> = { s: 240, a: 90, b: 35, c: 10 };
const BOUNDS = { minLat: 18.85, maxLat: 19.35, minLng: 72.7, maxLng: 73.15 };
const fetchedAt = '2026-09-13';

/** Dataset row name → curated slug (same mandal under its popular name). */
const CURATED_MATCH: Record<string, string> = {
  'Lalbaugcha Raja Sarvajanik Ganeshotsav Mandal': 'lalbaugcha-raja',
  'Mumbai Cha Raja, Ganesh Galli': 'mumbaicha-raja',
  'GSB Seva Mandal': 'gsb-seva-mandal',
  'Andheri Cha Raja': 'andhericha-raja',
  'Chinchpokli Sarvajanik Utsav Mandal': 'chinchpoklicha-chintamani',
  'Khetwadicha Ganraj': 'khetwadicha-ganraj',
  'Raja Tejukayacha': 'tejukaya',
  'Girgaoncha Raja Shree Ganeshotsav Mandal': 'girgaoncha-raja',
  'Keshavji Naik Chawl Ganeshotsav': 'keshavji-naik-chawl',
  'Fort Vibhag Ganesh Utsav Mandal': 'fort-cha-raja',
  'Parelcha Raja': 'parel-cha-raja', // Nare Park
  'Chembur Cha Raja': 'chembur-cha-raja',
  'Dongricha Raja': 'dongri-cha-raja',
  'Sahyadri Krida Mandal': 'sahyadri-krida-mandal',
  'Ghatkopar Cha Raja': 'ghatkoparcha-raja', // Laxminarayan Lane — Shri Laxminarayan Bal Ganesh Mitra Mandal
};

/** Row name → row it duplicates (same pandal); its name becomes a search alias. */
const DUPLICATE_OF: Record<string, string> = {
  // The dataset's own notes: one mandal at Ganesh Galli.
  'Lalbaug Sarvajanik Utsav Mandal': 'Mumbai Cha Raja, Ganesh Galli',
  'Anushakti Nagar Ganpati Mandal': 'Ganpati Mandal SPDC', // same address
  'Bal Gopal Mitra Mandal': 'Parel Sarvajanik Ganeshotsav Bal Gopal Mandal', // qa: same coords
  'Star Boys Mitra Mandal': 'Sion Koliwada Star Boys Mitra Mandal', // same address
};

/** Distinct mandals whose names differ only by spacing — disambiguate by locality. */
const DISPLAY_NAME: Record<string, string> = {
  'Malad Cha Raja': 'Malad Cha Raja (Matanpur Nagar)',
  'Maladcha Raja': 'Maladcha Raja (Goraswadi)',
};

interface Fix {
  lat: number;
  lng: number;
  precision: PinPrecision;
  source: string;
}

/** Rows whose coordinate failed the dataset's QA — replaced with a neighbourhood pin. */
const QA_FIX: Record<string, Fix> = {
  'Bhandup Jay Bajrang Mitra Mandal': {
    lat: 19.1462636,
    lng: 72.9339461,
    precision: 'area',
    source: 'OSM/Nominatim: Bhandup West suburb centre (dataset coordinate was 7.8 km off)',
  },
};

/** Curated mandals the dataset doesn't cover and with no public street address. */
const AREA_PINS_FOR_CURATED: Record<string, Fix> = {
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
  'vashicha-raja': {
    lat: 19.075784,
    lng: 72.9952364,
    precision: 'area',
    source: 'OSM/Nominatim: Vashi suburb centre (sources disagree: Sector 1 vs Sector 8)',
  },
};

/** Named, well-known mandals get the 'popular' baseline; others 'neighbourhood'. */
const POPULAR =
  /raja|ganraj|morya|moraya|peshwa|vighnesh|vighnaharta|chintamani|samrat|yuvraj|sarkar|mahaganpati|ganadhish|mumbai cha shree|gsb|chandanwadi|jitekar|tulshiwadi|oldest/i;

/** A street/building-level token → an unverified address is at least street-level. */
const STREET_TOKEN =
  /\d|road|\brd\b|marg|lane|\bln\b|galli|path|chowk|nivas|mansion|bhavan|park|complex|colony|society|subway|talao|chawl|garden|wadi\b/i;

const NOTE: Record<'unverified' | 'area', string> = {
  unverified:
    'Map pin is approximate — from an earlier community list, not verified. Confirm locally before you go.',
  area: 'Map pin marks the neighbourhood only — the exact pandal spot isn’t known. Ask locally for directions.',
};

interface Row {
  name: string;
  aliases: string[];
  area: string;
  address: string;
  lat: number;
  lng: number;
  source: string;
  precision: PinPrecision;
  verified: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function splitAliases(s: string): string[] {
  return s
    .split(';')
    .map((a) => a.trim())
    .filter(Boolean);
}

function uniqueAliases(name: string, aliases: string[]): string[] {
  const seen = new Set([norm(name)]);
  return aliases.filter((a) => {
    const k = norm(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function precisionOf(r: Record<string, string>): PinPrecision {
  if (r.verification === 'verified' && r.coord_precision === 'rooftop') return 'rooftop';
  const parts = r.address.split(',').map((p) => p.trim());
  const localityOnly = parts.indexOf('Mumbai') <= 1;
  const streetPart = r.address.replace(/Mumbai, Maharashtra \d{6}$/, '');
  if (r.coord_precision === 'area_centroid' || localityOnly || !STREET_TOKEN.test(streetPart)) {
    return 'area';
  }
  return 'street';
}

function loadRows(): Row[] {
  const raw = parseCsv(readFileSync(join(DB, 'community-mandals.csv'), 'utf8'));
  const rows: Row[] = [];
  for (const r of raw) {
    const fix = QA_FIX[r.mandal_name];
    if (r.qa_flag && !fix && !DUPLICATE_OF[r.mandal_name]) {
      throw new Error(`QA-flagged row needs a QA_FIX or DUPLICATE_OF entry: ${r.mandal_name} (${r.qa_flag})`);
    }
    rows.push({
      name: r.mandal_name,
      aliases: splitAliases(r.also_known_as),
      area: r.area,
      address: r.address,
      lat: fix?.lat ?? Number(r.latitude),
      lng: fix?.lng ?? Number(r.longitude),
      source:
        fix?.source ??
        (r.coord_source === 'google_places'
          ? `community dataset: Google Places (${r.coord_precision}, place_id ${r.place_id})`
          : `community dataset: earlier list (${r.coord_precision}, unverified)`),
      precision: fix?.precision ?? precisionOf(r),
      verified: r.verification === 'verified',
    });
  }
  for (const row of rows) {
    const inBounds =
      row.lat >= BOUNDS.minLat && row.lat <= BOUNDS.maxLat && row.lng >= BOUNDS.minLng && row.lng <= BOUNDS.maxLng;
    if (!row.name || !Number.isFinite(row.lat) || !Number.isFinite(row.lng) || !inBounds) {
      throw new Error(`Row missing a name or with coordinates outside Mumbai: ${row.name}`);
    }
  }
  return rows;
}

function main() {
  const curated = read<MandalData[]>('curated-mandals.json');
  const curatedPins = read<{ slug: string }[]>('curated-pins.json');
  const previous = read<MandalData[]>('static-directory.json');
  const rows = loadRows();
  const byName = new Map(rows.map((r) => [r.name, r]));

  for (const [dup, of] of Object.entries(DUPLICATE_OF)) {
    const target = byName.get(of);
    const source = byName.get(dup);
    if (!target || !source) throw new Error(`DUPLICATE_OF names not in CSV: ${dup} → ${of}`);
    target.aliases.push(dup, ...source.aliases);
  }
  for (const [name, slug] of Object.entries(CURATED_MATCH)) {
    if (!byName.has(name)) throw new Error(`CURATED_MATCH name not in CSV: ${name}`);
    if (!curated.some((m) => m.slug === slug)) throw new Error(`CURATED_MATCH slug not curated: ${slug}`);
  }

  // Stable ids/slugs: match rows to what the site already serves, by name or alias.
  const prevByKey = new Map<string, MandalData>();
  for (const m of previous) {
    prevByKey.set(norm(m.name), m);
    for (const a of m.aliases ?? []) prevByKey.set(norm(a), m);
  }
  let nextId = Math.max(...previous.map((m) => m.id), ...curated.map((m) => m.id)) + 1;
  let nextQueueId =
    Math.max(...[...previous, ...curated].flatMap((m) => m.queues.map((q) => q.id))) + 1;

  const pins: Record<string, unknown>[] = [];
  const pinEntry = (slug: string, lat: number, lng: number, precision: PinPrecision | null, source: string) =>
    pins.push({ slug, lat, lng, precision, source, fetchedAt });

  const dir: MandalData[] = [];
  const matched = new Set<string>();
  const log = { curated: [] as string[], added: [] as string[], merged: [] as string[] };

  // 1. Curated mandals, enriched with their dataset row where one exists.
  for (const c of curated) {
    const rowName = Object.keys(CURATED_MATCH).find((n) => CURATED_MATCH[n] === c.slug);
    const row = rowName ? byName.get(rowName) : undefined;
    const m: MandalData = { ...c, aliases: [], address: null, pinPrecision: null };
    if (row) {
      matched.add(row.name);
      m.aliases = uniqueAliases(c.name, [row.name, ...row.aliases]);
      m.address = row.address;
      m.idolLat = row.lat;
      m.idolLng = row.lng;
      m.pinPrecision = row.precision;
      if (!row.verified) m.notes = [c.notes.trim(), NOTE.unverified].filter(Boolean).join('\n\n');
      pinEntry(c.slug, row.lat, row.lng, row.precision, row.source);
      log.curated.push(`${c.slug} ← ${row.name} [${row.precision}]`);
    } else if (AREA_PINS_FOR_CURATED[c.slug]) {
      const fix = AREA_PINS_FOR_CURATED[c.slug];
      m.idolLat = fix.lat;
      m.idolLng = fix.lng;
      m.pinPrecision = fix.precision;
      m.notes = [c.notes.trim(), NOTE.area].filter(Boolean).join('\n\n');
      pinEntry(c.slug, fix.lat, fix.lng, fix.precision, fix.source);
      log.curated.push(`${c.slug} ← neighbourhood pin (${fix.source})`);
    } else {
      const orig = curatedPins.find((p) => p.slug === c.slug);
      if (orig) pins.push(orig);
      log.curated.push(`${c.slug} (kept original ${orig ? 'OSM pin' : 'data'})`);
    }
    dir.push(m);
  }

  // 2. Everything else in the dataset.
  for (const row of rows) {
    if (matched.has(row.name)) continue;
    if (DUPLICATE_OF[row.name]) {
      log.merged.push(`${row.name} → ${DUPLICATE_OF[row.name]}`);
      continue;
    }
    const name = DISPLAY_NAME[row.name] ?? row.name;
    const prev = [name, row.name, ...row.aliases]
      .map((k) => prevByKey.get(norm(k)))
      .find((p) => p && !dir.some((d) => d.id === p.id));
    const tier: Tier = POPULAR.test(`${row.name} ${row.aliases.join(' ')}`) ? 'b' : 'c';
    const slug = prev?.slug ?? slugify(name);
    const notes = row.precision === 'area' ? NOTE.area : row.verified ? '' : NOTE.unverified;
    dir.push({
      id: prev?.id ?? nextId++,
      slug,
      name,
      nameMr: null,
      nameHi: null,
      aliases: uniqueAliases(name, name === row.name ? row.aliases : [row.name, ...row.aliases]),
      area: row.area,
      tier,
      idolLat: row.lat,
      idolLng: row.lng,
      pinPrecision: row.precision,
      address: row.address,
      nearestStation: null,
      stationWalkMinutes: null,
      notes,
      queues: [
        {
          id: prev?.queues[0]?.id ?? nextQueueId++,
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
    });
    pinEntry(slug, row.lat, row.lng, row.precision, row.source);
    log.added.push(`${slug} [${tier}, ${row.precision}]${prev ? ' (existing id kept)' : ''}`);
  }

  const problems = directoryProblems(dir);
  if (problems.length) throw new Error(`Directory check failed:\n  ${problems.join('\n  ')}`);

  // Area, then tier, then name. Never by wait.
  const TIER_ORDER: Record<Tier, number> = { s: 0, a: 1, b: 2, c: 3 };
  dir.sort(
    (a, b) =>
      a.area.localeCompare(b.area) || TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.name.localeCompare(b.name),
  );

  writeFileSync(join(DB, 'static-directory.json'), JSON.stringify(dir, null, 2) + '\n');
  writeFileSync(join(DB, 'geocoded-pins.json'), JSON.stringify(pins, null, 2) + '\n');

  const kept = new Set(dir.map((m) => m.slug));
  const removed = previous.filter((m) => !kept.has(m.slug)).map((m) => m.slug);
  const count = (p: PinPrecision | null) => dir.filter((m) => m.pinPrecision === p).length;
  console.log(`Curated (${log.curated.length}):\n  ${log.curated.join('\n  ')}`);
  console.log(`\nAdded from dataset (${log.added.length}):\n  ${log.added.join('\n  ')}`);
  console.log(`\nMerged duplicates (${log.merged.length}):\n  ${log.merged.join('\n  ')}`);
  console.log(`\nRemoved since last build (${removed.length}):\n  ${removed.join('\n  ')}`);
  console.log(
    `\n${dir.length} mandals, all pinned — rooftop ${count('rooftop')}, street ${count('street')}, ` +
      `area ${count('area')}, original OSM ${count(null)}.`,
  );
}

main();
