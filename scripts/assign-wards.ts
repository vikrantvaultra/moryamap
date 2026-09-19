/**
 * Stamp every mandal with its BMC ward — run with:
 *
 *   npx tsx scripts/assign-wards.ts
 *
 * Why: "area" in the directory is free-text locality (66 distinct values for
 * 128 mandals), which is useless as a browse axis. The ward is how BMC and
 * the police actually organise Ganeshotsav — 24 buckets covering all of
 * Greater Mumbai — so it's what the map and list filter by.
 *
 * Source: OpenStreetMap administrative boundaries (ODbL), the same licence
 * as the pins already in this directory:
 *   admin_level=10 → the 24 BMC wards (A, B, … F/S, K/E, R/C …)
 *   admin_level=8  → municipal corporations, for the handful of directory
 *                    mandals outside Greater Mumbai (Thane, Navi Mumbai,
 *                    Mira-Bhayander, Kalyan-Dombivli, Panvel)
 * A BMC ward always wins over the corporation that contains it.
 *
 * Outputs
 *   src/db/static-directory.json  each mandal gains `ward`
 *   src/db/ward-pins.json         provenance: slug → ward, OSM relation, date
 *
 * Boundaries are fetched live rather than vendored — 1.2 MB of ring
 * coordinates has no business in the repo when only the label is shipped.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MandalData } from '../src/lib/queries';

const DB = join(__dirname, '..', 'src', 'db');
const BBOX = '18.85,72.70,19.40,73.20';
const UA = 'MoryaMap/1.0 (Ganeshotsav ward assignment; github.com/moryamap)';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

type Point = [number, number]; // [lng, lat]

interface OsmMember {
  role: string;
  geometry?: { lat: number; lon: number }[];
}
interface OsmRelation {
  id: number;
  tags: Record<string, string>;
  members?: OsmMember[];
}

interface Zone {
  /** 'D', 'F/S', 'Thane' … */
  name: string;
  /** 'bmc' (admin_level 10) or 'municipal' (admin_level 8). */
  kind: 'bmc' | 'municipal';
  relationId: number;
  rings: Point[][];
}

const QUERY = `[out:json][timeout:180];
(
  relation["boundary"="administrative"]["admin_level"="10"](${BBOX});
  relation["boundary"="administrative"]["admin_level"="8"](${BBOX});
);
out geom;`;

/**
 * Stitch a relation's outer member ways into closed rings. Overpass returns
 * each way's own geometry in arbitrary order and direction, so walk the
 * segments joining head-to-tail until the ring closes.
 */
function ringsOf(rel: OsmRelation): Point[][] {
  const key = (p: { lat: number; lon: number }) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
  const segments = (rel.members ?? [])
    .filter((m) => m.role === 'outer' && m.geometry && m.geometry.length > 1)
    .map((m) => m.geometry!.slice());
  const rings: Point[][] = [];

  while (segments.length > 0) {
    let ring = segments.shift()!;
    let joined = true;
    while (joined && key(ring[0]) !== key(ring[ring.length - 1])) {
      joined = false;
      const tail = key(ring[ring.length - 1]);
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (key(seg[0]) === tail) {
          ring = ring.concat(seg.slice(1));
        } else if (key(seg[seg.length - 1]) === tail) {
          ring = ring.concat(seg.slice().reverse().slice(1));
        } else {
          continue;
        }
        segments.splice(i, 1);
        joined = true;
        break;
      }
    }
    // An unclosed fragment (a boundary drawn with a gap) is dropped rather
    // than guessed at — a mandal near it simply falls through to the
    // containing corporation, which is still true.
    if (ring.length > 3 && key(ring[0]) === key(ring[ring.length - 1])) {
      rings.push(ring.map((p) => [p.lon, p.lat] as Point));
    }
  }
  return rings;
}

/** Ray casting. Boundary-exact points are vanishingly unlikely here. */
function inRing(lng: number, lat: number, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const contains = (z: Zone, lng: number, lat: number) => z.rings.some((r) => inRing(lng, lat, r));

async function fetchZones(): Promise<Zone[]> {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`);
  const { elements } = (await res.json()) as { elements: OsmRelation[] };

  const zones: Zone[] = [];
  for (const rel of elements) {
    const name = rel.tags?.name;
    if (!name) continue;
    const kind = rel.tags.admin_level === '10' ? 'bmc' : 'municipal';
    // OSM names BMC wards "D Ward", "F/S Ward"; the label people use is the letter.
    const label = kind === 'bmc' ? name.replace(/\s*Ward$/i, '').trim() : name;
    const rings = ringsOf(rel);
    if (rings.length > 0) zones.push({ name: label, kind, relationId: rel.id, rings });
  }
  return zones;
}

async function main() {
  const file = join(DB, 'static-directory.json');
  const dir = JSON.parse(readFileSync(file, 'utf8')) as MandalData[];

  console.log('Fetching BMC ward + municipal boundaries from OpenStreetMap…');
  const zones = await fetchZones();
  const bmc = zones.filter((z) => z.kind === 'bmc');
  const municipal = zones.filter((z) => z.kind === 'municipal');
  console.log(`  ${bmc.length} BMC wards, ${municipal.length} municipal corporations.`);
  if (bmc.length < 20) throw new Error(`Only ${bmc.length} BMC wards came back — refusing to write.`);

  const fetchedAt = new Date().toISOString().slice(0, 10);
  const pins: Record<string, unknown>[] = [];
  const unplaced: string[] = [];
  const tally = new Map<string, number>();

  for (const m of dir) {
    const lat = m.idolLat;
    const lng = m.idolLng;
    if (lat == null || lng == null) {
      m.ward = null;
      unplaced.push(`${m.slug} (no pin)`);
      continue;
    }
    // A BMC ward beats the corporation containing it.
    const zone =
      bmc.find((z) => contains(z, lng, lat)) ?? municipal.find((z) => contains(z, lng, lat));
    m.ward = zone?.name ?? null;
    if (!zone) {
      unplaced.push(`${m.slug} @ ${lat},${lng} (${m.area})`);
      continue;
    }
    tally.set(zone.name, (tally.get(zone.name) ?? 0) + 1);
    pins.push({
      slug: m.slug,
      ward: zone.name,
      wardKind: zone.kind,
      source: `OpenStreetMap relation ${zone.relationId} (admin_level ${zone.kind === 'bmc' ? 10 : 8})`,
      fetchedAt,
    });
  }

  writeFileSync(file, JSON.stringify(dir, null, 2) + '\n');
  writeFileSync(join(DB, 'ward-pins.json'), JSON.stringify(pins, null, 2) + '\n');

  const byCount = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  console.log(`\n${pins.length} of ${dir.length} mandals placed in ${tally.size} wards:`);
  console.log('  ' + byCount.map(([w, n]) => `${w} ${n}`).join(' · '));
  if (unplaced.length) console.log(`\nUnplaced (${unplaced.length}):\n  ${unplaced.join('\n  ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
