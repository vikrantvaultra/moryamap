'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { crowdReports, queueEntryPoints } from '@/db/schema';
import { clientIpFrom, hashWithSalt } from '@/lib/hash';
import { estimateForQueue, getMandalDirectory } from '@/lib/queries';
import { getReportLimiter } from '@/lib/ratelimit';
import { toIst } from '@/lib/wait';

function reportPath(locale: string, queueId: number, outcome?: string): string {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return `${prefix}/report/${queueId}${outcome ? `/${outcome}` : ''}`;
}

/** Heuristic snapshot at report time — the calibration paper trail. */
async function heuristicFor(queueId: number) {
  try {
    const dir = await getMandalDirectory();
    const q = dir.flatMap((m) => m.queues).find((q) => q.id === queueId);
    if (!q) return {};
    const est = estimateForQueue(q);
    return {
      heuristicLowMinutes: est.lowMinutes,
      heuristicHighMinutes: est.highMinutes,
      heuristicProvenance: est.provenance,
    };
  } catch {
    return {};
  }
}

async function identify() {
  const h = await headers();
  return {
    ipHash: hashWithSalt(clientIpFrom(h)),
    userAgentHash: hashWithSalt(h.get('user-agent') ?? ''),
  };
}

async function rateLimited(queueId: number, ipHash: string): Promise<boolean> {
  const limiter = getReportLimiter();
  if (!limiter) return false;
  const { success } = await limiter.limit(`${queueId}:${ipHash}`);
  return !success;
}

export async function submitEntryPointReport(formData: FormData) {
  const queueId = Number(formData.get('queueId'));
  const entryPointId = Number(formData.get('entryPointId'));
  const locale = String(formData.get('locale') ?? 'en');

  if (!Number.isInteger(queueId) || queueId <= 0) redirect('/');
  // Static-fallback mode (no DB): reports can't be stored.
  if (!process.env.DATABASE_URL) redirect(reportPath(locale, queueId, 'invalid'));
  if (!Number.isInteger(entryPointId) || entryPointId <= 0) {
    redirect(reportPath(locale, queueId, 'invalid'));
  }

  const { ipHash, userAgentHash } = await identify();
  if (await rateLimited(queueId, ipHash)) {
    redirect(reportPath(locale, queueId, 'limited'));
  }

  const db = getDb();
  const [ep] = await db
    .select({ id: queueEntryPoints.id })
    .from(queueEntryPoints)
    .where(and(eq(queueEntryPoints.id, entryPointId), eq(queueEntryPoints.queueId, queueId)));
  if (!ep) redirect(reportPath(locale, queueId, 'invalid'));

  await db.insert(crowdReports).values({
    queueId,
    kind: 'entry_point',
    entryPointId,
    ipHash,
    userAgentHash,
    ...(await heuristicFor(queueId)),
  });

  redirect(reportPath(locale, queueId, 'sent'));
}

/** "HH:MM" IST wall clock (today, or yesterday if it crossed midnight) → UTC Date. */
function istTimeToUtc(hhmm: string, now: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  const ist = toIst(now);
  const utcMs =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hh, mm) -
    5.5 * 60 * 60 * 1000;
  return new Date(utcMs);
}

export async function submitCompletedWait(formData: FormData) {
  const queueId = Number(formData.get('queueId'));
  const locale = String(formData.get('locale') ?? 'en');
  if (!Number.isInteger(queueId) || queueId <= 0) redirect('/');
  if (!process.env.DATABASE_URL) redirect(reportPath(locale, queueId, 'invalid'));

  const now = new Date();
  let joinedAt = istTimeToUtc(String(formData.get('joined') ?? ''), now);
  let darshanAt = istTimeToUtc(String(formData.get('darshan') ?? ''), now);
  if (!joinedAt || !darshanAt) redirect(reportPath(locale, queueId, 'invalid'));

  // Future times mean "earlier today was meant" is impossible — walk both
  // back a day if needed, and treat darshan<joined as a midnight crossing.
  const DAY = 24 * 60 * 60 * 1000;
  if (darshanAt.getTime() > now.getTime()) darshanAt = new Date(darshanAt.getTime() - DAY);
  if (joinedAt.getTime() > darshanAt.getTime()) joinedAt = new Date(joinedAt.getTime() - DAY);

  const waitedMinutes = (darshanAt.getTime() - joinedAt.getTime()) / 60_000;
  if (waitedMinutes <= 0 || waitedMinutes > 18 * 60) {
    redirect(reportPath(locale, queueId, 'invalid'));
  }

  const { ipHash, userAgentHash } = await identify();
  if (await rateLimited(queueId, ipHash)) {
    redirect(reportPath(locale, queueId, 'limited'));
  }

  await getDb()
    .insert(crowdReports)
    .values({
      queueId,
      kind: 'completed_wait',
      joinedAt,
      darshanAt,
      ipHash,
      userAgentHash,
      ...(await heuristicFor(queueId)),
    });

  redirect(reportPath(locale, queueId, 'sent-times'));
}
