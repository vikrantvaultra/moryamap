/**
 * Bulk-import mandals from a CSV — built for the day you obtain the BMC
 * ward-wise mandal list (the MCGM permissions portal has no public
 * machine-readable export, so that list has to come via the ward office,
 * RTI, or portal access).
 *
 * Usage:  npx tsx src/db/import-mandals.ts path/to/mandals.csv
 *
 * CSV columns (header row required, order free):
 *   name        required
 *   area        required
 *   nameMr, nameHi, tier (s|a|b|c, default c), nearestStation   optional
 *   lat, lng    optional — APPROXIMATE mandal location only (e.g. from the
 *               BMC record). Rendered as an "≈ approximate" marker, never
 *               as a queue-start pin. Queue starts are pinned in /admin.
 *
 * Rows whose generated slug already exists are skipped, so re-running is
 * safe. Each imported mandal gets one 'general' queue with its tier's
 * baseline wait.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { mandals, queues, type Tier } from './schema';

const BASE_BY_TIER: Record<Tier, number> = { s: 240, a: 90, b: 35, c: 10 };
const MUMBAI = { minLat: 18.5, maxLat: 19.6, minLng: 72.5, maxLng: 73.4 };

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);

  const [header, ...body] = rows;
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx tsx src/db/import-mandals.ts path/to/mandals.csv');
    process.exit(1);
  }
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const db = getDb();
  let imported = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.name || !r.area) {
      console.warn('skip (name/area missing):', JSON.stringify(r).slice(0, 80));
      skipped++;
      continue;
    }
    const slug = slugify(r.name);
    const existing = await db.select({ id: mandals.id }).from(mandals).where(eq(mandals.slug, slug));
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const tier: Tier = (['s', 'a', 'b', 'c'] as const).includes(r.tier as Tier)
      ? (r.tier as Tier)
      : 'c';
    let lat = r.lat ? Number(r.lat) : null;
    let lng = r.lng ? Number(r.lng) : null;
    const valid =
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= MUMBAI.minLat &&
      lat <= MUMBAI.maxLat &&
      lng >= MUMBAI.minLng &&
      lng <= MUMBAI.maxLng;
    if (!valid) {
      if (r.lat || r.lng) console.warn(`coords outside Mumbai dropped for: ${r.name}`);
      lat = null;
      lng = null;
    }

    const [mandal] = await db
      .insert(mandals)
      .values({
        slug,
        name: r.name,
        nameMr: r.nameMr || null,
        nameHi: r.nameHi || null,
        area: r.area,
        tier,
        idolLat: lat,
        idolLng: lng,
        nearestStation: r.nearestStation || null,
      })
      .returning();

    await db.insert(queues).values({
      mandalId: mandal.id,
      kind: 'general',
      label: 'Darshan',
      labelMr: 'दर्शन',
      baseMinutes: BASE_BY_TIER[tier],
    });
    imported++;
  }

  console.log(`Imported ${imported}, skipped ${skipped} (existing/invalid).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
