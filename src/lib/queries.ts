import { unstable_cache } from 'next/cache';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { crowdReports, mandals, queueEntryPoints, queues } from '@/db/schema';
import type { QueueKind, Tier } from '@/db/schema';
import { estimateWait, REPORT_FRESHNESS_MINUTES, type WaitEstimate } from '@/lib/wait';

// Everything returned here is JSON-serializable (unstable_cache round-trips
// through JSON), so timestamps travel as ISO strings.

export interface EntryPointData {
  id: number;
  sequence: number;
  landmark: string;
  landmarkMr: string | null;
  lat: number | null;
  lng: number | null;
  impliedMinutes: number | null;
}

export interface ReportData {
  impliedMinutes: number;
  reportedAt: string;
  landmark: string;
  landmarkMr: string | null;
}

export interface QueueData {
  id: number;
  kind: QueueKind;
  label: string;
  labelMr: string | null;
  entryLat: number | null;
  entryLng: number | null;
  baseMinutes: number;
  entryPoints: EntryPointData[];
  /** Latest ACCEPTED entry_point report within the freshness window, if any. */
  report: ReportData | null;
}

export interface MandalData {
  id: number;
  slug: string;
  name: string;
  nameMr: string | null;
  nameHi: string | null;
  area: string;
  tier: Tier;
  idolLat: number | null;
  idolLng: number | null;
  nearestStation: string | null;
  stationWalkMinutes: number | null;
  notes: string;
  queues: QueueData[];
}

const TIER_ORDER: Record<Tier, number> = { s: 0, a: 1, b: 2, c: 3 };

async function fetchDirectory(): Promise<MandalData[]> {
  const db = getDb();

  const ms = await db.select().from(mandals).where(eq(mandals.isActive, true));
  const mandalIds = ms.map((m) => m.id);
  const qs = mandalIds.length
    ? await db.select().from(queues).where(inArray(queues.mandalId, mandalIds))
    : [];
  const queueIds = qs.map((q) => q.id);
  const eps = queueIds.length
    ? await db
        .select()
        .from(queueEntryPoints)
        .where(inArray(queueEntryPoints.queueId, queueIds))
        .orderBy(queueEntryPoints.sequence)
    : [];

  const cutoff = new Date(Date.now() - REPORT_FRESHNESS_MINUTES * 60_000);
  const reports = queueIds.length
    ? await db
        .select({
          queueId: crowdReports.queueId,
          reportedAt: crowdReports.reportedAt,
          impliedMinutes: queueEntryPoints.impliedMinutes,
          landmark: queueEntryPoints.landmark,
          landmarkMr: queueEntryPoints.landmarkMr,
        })
        .from(crowdReports)
        .innerJoin(queueEntryPoints, eq(crowdReports.entryPointId, queueEntryPoints.id))
        .where(
          and(
            inArray(crowdReports.queueId, queueIds),
            eq(crowdReports.status, 'accepted'),
            eq(crowdReports.kind, 'entry_point'),
            gt(crowdReports.reportedAt, cutoff),
          ),
        )
        .orderBy(desc(crowdReports.reportedAt))
    : [];

  const latestByQueue = new Map<number, ReportData>();
  for (const r of reports) {
    if (r.impliedMinutes == null || latestByQueue.has(r.queueId)) continue;
    latestByQueue.set(r.queueId, {
      impliedMinutes: r.impliedMinutes,
      reportedAt: r.reportedAt.toISOString(),
      landmark: r.landmark,
      landmarkMr: r.landmarkMr,
    });
  }

  const epsByQueue = new Map<number, EntryPointData[]>();
  for (const ep of eps) {
    const list = epsByQueue.get(ep.queueId) ?? [];
    list.push({
      id: ep.id,
      sequence: ep.sequence,
      landmark: ep.landmark,
      landmarkMr: ep.landmarkMr,
      lat: ep.lat,
      lng: ep.lng,
      impliedMinutes: ep.impliedMinutes,
    });
    epsByQueue.set(ep.queueId, list);
  }

  const result: MandalData[] = ms.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    nameMr: m.nameMr,
    nameHi: m.nameHi,
    area: m.area,
    tier: m.tier,
    idolLat: m.idolLat,
    idolLng: m.idolLng,
    nearestStation: m.nearestStation,
    stationWalkMinutes: m.stationWalkMinutes,
    notes: m.notes,
    queues: qs
      .filter((q) => q.mandalId === m.id)
      .map((q) => ({
        id: q.id,
        kind: q.kind,
        label: q.label,
        labelMr: q.labelMr,
        entryLat: q.entryLat,
        entryLng: q.entryLng,
        baseMinutes: q.baseMinutes,
        entryPoints: epsByQueue.get(q.id) ?? [],
        report: latestByQueue.get(q.id) ?? null,
      })),
  }));

  // Popularity/area ordering only. NEVER sort by current wait — steering
  // crowds toward "short queues" is a safety hazard.
  result.sort(
    (a, b) =>
      a.area.localeCompare(b.area) ||
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      a.name.localeCompare(b.name),
  );
  return result;
}

/** One cached entry covers the whole directory (15 mandals). Tag: 'queues'. */
export const getMandalDirectory = unstable_cache(fetchDirectory, ['mandal-directory'], {
  revalidate: 60,
  tags: ['queues'],
});

export async function getMandalBySlug(slug: string): Promise<MandalData | null> {
  const all = await getMandalDirectory();
  return all.find((m) => m.slug === slug) ?? null;
}

/**
 * For generateStaticParams. Returns [] when the DB is unreachable (e.g. a
 * build without DATABASE_URL) — pages then generate on demand via ISR.
 */
export async function getAllMandalSlugs(): Promise<string[]> {
  try {
    const db = getDb();
    const rows = await db.select({ slug: mandals.slug }).from(mandals);
    return rows.map((r) => r.slug);
  } catch (err) {
    console.warn('[build] mandal slugs unavailable, deferring to ISR:', (err as Error).message);
    return [];
  }
}

/** Freshness is re-checked here at render time, not at query time. */
export function estimateForQueue(q: QueueData, at: Date = new Date()): WaitEstimate {
  return estimateWait({
    baseMinutes: q.baseMinutes,
    at,
    report: q.report
      ? { impliedMinutes: q.report.impliedMinutes, reportedAt: new Date(q.report.reportedAt) }
      : null,
  });
}
