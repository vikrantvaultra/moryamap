import { unstable_cache } from 'next/cache';
import staticDirectory from '@/db/static-directory.json';
import type { QueueKind, Tier } from '@/db/schema';
import { estimateWait, type WaitEstimate } from '@/lib/wait';

/**
 * How precise a mandal pin is: 'rooftop' = verified place, 'street' =
 * unverified street address, 'area' = neighbourhood only. The UI says which.
 */
export type PinPrecision = 'rooftop' | 'street' | 'area';

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
  /** Null = approximate venue geocode (provenance in geocoded-pins.json). */
  pinPrecision: PinPrecision | null;
  /** Other names / descriptors people search by. */
  aliases: string[];
  /** Postal address as listed by the source. Not a queue start. */
  address: string | null;
  nearestStation: string | null;
  stationWalkMinutes: number | null;
  notes: string;
  queues: QueueData[];
}

/**
 * The mandal directory is HARDCODED: src/db/static-directory.json is the
 * single source of truth (regenerate it with scripts/build-directory.ts).
 * No database is read. Waits are still computed live from baseMinutes by the
 * estimator, with honest provenance labels; there are no crowd reports.
 */
export async function fetchDirectory(): Promise<MandalData[]> {
  // Already stored in area → tier → name order. NEVER sort by current wait —
  // steering crowds toward "short queues" is a safety hazard.
  return staticDirectory as MandalData[];
}

/** One cached entry covers the whole directory. Tag: 'queues'. */
export const getMandalDirectory = unstable_cache(fetchDirectory, ['mandal-directory'], {
  revalidate: 60,
  tags: ['queues'],
});

export async function getQueueContext(
  queueId: number,
): Promise<{ mandal: MandalData; queue: QueueData } | null> {
  const all = await getMandalDirectory();
  for (const mandal of all) {
    const queue = mandal.queues.find((q) => q.id === queueId);
    if (queue) return { mandal, queue };
  }
  return null;
}

export async function getMandalBySlug(slug: string): Promise<MandalData | null> {
  const all = await getMandalDirectory();
  return all.find((m) => m.slug === slug) ?? null;
}

/** For generateStaticParams — every mandal page is prebuilt. */
export async function getAllMandalSlugs(): Promise<string[]> {
  return (await fetchDirectory()).map((m) => m.slug);
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
