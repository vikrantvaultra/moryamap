'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { crowdReports, mandals, queueEntryPoints, queues } from '@/db/schema';
import { refreshSnapshotState } from '@/lib/snapshot';

/** Every accepted mutation: bust the ISR data cache AND rebuild the Redis state. */
async function propagate() {
  revalidateTag('queues');
  try {
    await refreshSnapshotState();
  } catch (err) {
    console.error('[admin] snapshot refresh failed:', err);
  }
}

export async function moderateReport(formData: FormData) {
  const id = Number(formData.get('id'));
  const decision = String(formData.get('decision'));
  if (!Number.isInteger(id) || !['accepted', 'rejected'].includes(decision)) return;
  await getDb()
    .update(crowdReports)
    .set({ status: decision as 'accepted' | 'rejected' })
    .where(eq(crowdReports.id, id));
  if (decision === 'accepted') await propagate();
  redirect('/admin');
}

export async function toggleMandal(formData: FormData) {
  const id = Number(formData.get('id'));
  const active = String(formData.get('active')) === 'true';
  if (!Number.isInteger(id)) return;
  await getDb().update(mandals).set({ isActive: active }).where(eq(mandals.id, id));
  await propagate();
  redirect('/admin');
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function inMumbaiBounds(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return true; // clearing a pin is fine
  return lat >= 18.5 && lat <= 19.6 && lng >= 72.5 && lng <= 73.4;
}

export async function updateMandal(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id)) return;
  const db = getDb();

  const idolLat = numOrNull(formData.get('idolLat'));
  const idolLng = numOrNull(formData.get('idolLng'));
  if (!inMumbaiBounds(idolLat, idolLng)) redirect(`/admin/m/${id}?err=bounds`);

  await db
    .update(mandals)
    .set({
      notes: String(formData.get('notes') ?? ''),
      nearestStation: String(formData.get('nearestStation') ?? '') || null,
      stationWalkMinutes: numOrNull(formData.get('stationWalkMinutes')),
      idolLat,
      idolLng,
    })
    .where(eq(mandals.id, id));

  // Queue rows: q_<id>_entryLat / entryLng / baseMinutes
  const queueRows = await db.select().from(queues).where(eq(queues.mandalId, id));
  for (const q of queueRows) {
    const entryLat = numOrNull(formData.get(`q_${q.id}_entryLat`));
    const entryLng = numOrNull(formData.get(`q_${q.id}_entryLng`));
    if (!inMumbaiBounds(entryLat, entryLng)) redirect(`/admin/m/${id}?err=bounds`);
    const baseMinutes = numOrNull(formData.get(`q_${q.id}_baseMinutes`));
    await db
      .update(queues)
      .set({ entryLat, entryLng, ...(baseMinutes != null ? { baseMinutes } : {}) })
      .where(eq(queues.id, q.id));

    // Entry points: ep_<id>_landmark / landmarkMr / implied / lat / lng
    const eps = await db
      .select()
      .from(queueEntryPoints)
      .where(eq(queueEntryPoints.queueId, q.id));
    for (const ep of eps) {
      if (formData.get(`ep_${ep.id}_landmark`) == null) continue;
      const lat = numOrNull(formData.get(`ep_${ep.id}_lat`));
      const lng = numOrNull(formData.get(`ep_${ep.id}_lng`));
      if (!inMumbaiBounds(lat, lng)) redirect(`/admin/m/${id}?err=bounds`);
      await db
        .update(queueEntryPoints)
        .set({
          landmark: String(formData.get(`ep_${ep.id}_landmark`) ?? ep.landmark),
          landmarkMr: String(formData.get(`ep_${ep.id}_landmarkMr`) ?? '') || null,
          impliedMinutes: numOrNull(formData.get(`ep_${ep.id}_implied`)),
          lat,
          lng,
        })
        .where(eq(queueEntryPoints.id, ep.id));
    }
  }

  await propagate();
  redirect(`/admin/m/${id}?saved=1`);
}
