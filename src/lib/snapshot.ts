import { getRedis } from '@/lib/redis';
import { estimateForQueue, fetchDirectory, type MandalData } from '@/lib/queries';

const STATE_KEY = 'morya:state:v1';
const STATE_TTL_SECONDS = 300;

interface StoredState {
  generatedAt: string;
  mandals: MandalData[];
}

/**
 * The raw directory state, served from Upstash. Postgres is only touched on
 * a cache miss (~ once per 5 min) or an explicit refresh after a mutation.
 */
export async function getSnapshotState(): Promise<StoredState> {
  const redis = getRedis();
  if (redis) {
    const cached = await redis.get<StoredState>(STATE_KEY);
    if (cached) return cached;
  }
  return refreshSnapshotState();
}

/** Rebuild from Postgres and store. Called on report accept / admin edits. */
export async function refreshSnapshotState(): Promise<StoredState> {
  const state: StoredState = {
    generatedAt: new Date().toISOString(),
    mandals: await fetchDirectory(),
  };
  const redis = getRedis();
  if (redis) {
    await redis.set(STATE_KEY, state, { ex: STATE_TTL_SECONDS });
  }
  return state;
}

/**
 * Public snapshot payload. Wait figures are computed at CALL time from the
 * stored state, so hour factors and the 90-minute report expiry are always
 * applied against the current clock, not the time the state was cached.
 */
export function buildPublicSnapshot(state: StoredState) {
  const now = new Date();
  return {
    generatedAt: state.generatedAt,
    computedAt: now.toISOString(),
    // Honesty contract for third-party consumers of this endpoint too.
    notice:
      'Wait figures are ranges with provenance. provenance=estimate means heuristic from past festivals, NOT live data. Never present these as exact or live.',
    mandals: state.mandals.map((m) => ({
      slug: m.slug,
      name: m.name,
      nameMr: m.nameMr,
      nameHi: m.nameHi,
      area: m.area,
      tier: m.tier,
      // Mandal location (often geocoded/approximate) — NOT the queue start.
      idolLat: m.idolLat,
      idolLng: m.idolLng,
      nearestStation: m.nearestStation,
      stationWalkMinutes: m.stationWalkMinutes,
      queues: m.queues.map((q) => {
        const est = estimateForQueue(q, now);
        return {
          id: q.id,
          kind: q.kind,
          label: q.label,
          labelMr: q.labelMr,
          entryLat: q.entryLat,
          entryLng: q.entryLng,
          wait: {
            lowMinutes: est.lowMinutes,
            highMinutes: est.highMinutes,
            unit: est.unit,
            band: est.band,
            provenance: est.provenance,
            reportedAt: est.provenance === 'reported' ? q.report?.reportedAt : undefined,
            reportedLandmark: est.provenance === 'reported' ? q.report?.landmark : undefined,
            reportedLandmarkMr: est.provenance === 'reported' ? q.report?.landmarkMr : undefined,
          },
        };
      }),
    })),
  };
}

export type PublicSnapshot = ReturnType<typeof buildPublicSnapshot>;
export type SnapshotMandal = PublicSnapshot['mandals'][number];
export type SnapshotQueue = SnapshotMandal['queues'][number];
