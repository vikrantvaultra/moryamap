import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { mandals, queueEntryPoints, queues } from '@/db/schema';
import EditorShell from '@/components/admin/EditorShell';

export const dynamic = 'force-dynamic';

export default async function AdminMandalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; err?: string }>;
}) {
  const { id: rawId } = await params;
  const sp = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const [mandal] = await db.select().from(mandals).where(eq(mandals.id, id));
  if (!mandal) notFound();

  const qs = await db.select().from(queues).where(eq(queues.mandalId, id));
  const qIds = qs.map((q) => q.id);
  const eps = qIds.length
    ? await db
        .select()
        .from(queueEntryPoints)
        .where(inArray(queueEntryPoints.queueId, qIds))
        .orderBy(queueEntryPoints.sequence)
    : [];

  return (
    <div>
      <Link href="/admin" className="text-xs font-medium text-stone-500 hover:text-stone-800">
        ← All mandals
      </Link>
      <h1 className="mb-4 mt-1 text-lg font-bold">Edit: {mandal.name}</h1>
      <EditorShell
        mandal={{
          id: mandal.id,
          name: mandal.name,
          area: mandal.area,
          tier: mandal.tier,
          idolLat: mandal.idolLat,
          idolLng: mandal.idolLng,
          nearestStation: mandal.nearestStation,
          stationWalkMinutes: mandal.stationWalkMinutes,
          notes: mandal.notes,
        }}
        queues={qs.map((q) => ({
          id: q.id,
          label: q.label,
          baseMinutes: q.baseMinutes,
          entryLat: q.entryLat,
          entryLng: q.entryLng,
          entryPoints: eps
            .filter((ep) => ep.queueId === q.id)
            .map((ep) => ({
              id: ep.id,
              sequence: ep.sequence,
              landmark: ep.landmark,
              landmarkMr: ep.landmarkMr,
              lat: ep.lat,
              lng: ep.lng,
              impliedMinutes: ep.impliedMinutes,
            })),
        }))}
        saved={sp.saved === '1'}
        err={sp.err ?? null}
      />
    </div>
  );
}
