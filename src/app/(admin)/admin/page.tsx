import Link from 'next/link';
import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { crowdReports, mandals, queueEntryPoints, queues } from '@/db/schema';
import { moderateReport, toggleMandal } from './actions';

export const dynamic = 'force-dynamic';

function fmtIst(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export default async function AdminPage() {
  const db = getDb();

  const pending = await db
    .select({
      id: crowdReports.id,
      kind: crowdReports.kind,
      reportedAt: crowdReports.reportedAt,
      joinedAt: crowdReports.joinedAt,
      darshanAt: crowdReports.darshanAt,
      ipHash: crowdReports.ipHash,
      heuristicLow: crowdReports.heuristicLowMinutes,
      heuristicHigh: crowdReports.heuristicHighMinutes,
      queueLabel: queues.label,
      mandalName: mandals.name,
      landmark: queueEntryPoints.landmark,
    })
    .from(crowdReports)
    .innerJoin(queues, eq(crowdReports.queueId, queues.id))
    .innerJoin(mandals, eq(queues.mandalId, mandals.id))
    .leftJoin(queueEntryPoints, eq(crowdReports.entryPointId, queueEntryPoints.id))
    .where(eq(crowdReports.status, 'pending'))
    .orderBy(desc(crowdReports.reportedAt))
    .limit(100);

  const allMandals = await db.select().from(mandals).orderBy(mandals.area, mandals.name);
  const mandalIds = allMandals.map((m) => m.id);
  const allQueues = mandalIds.length
    ? await db.select().from(queues).where(inArray(queues.mandalId, mandalIds))
    : [];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-lg font-bold">Pending reports ({pending.length})</h1>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Nothing waiting. 🎉</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-stone-300 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">When (IST)</th>
                  <th className="px-3 py-2">Queue</th>
                  <th className="px-3 py-2">Report</th>
                  <th className="px-3 py-2">Heuristic then</th>
                  <th className="px-3 py-2">Reporter</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2">{fmtIst(r.reportedAt)}</td>
                    <td className="px-3 py-2">
                      {r.mandalName}
                      <span className="block text-xs text-stone-500">{r.queueLabel}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r.kind === 'entry_point' ? (
                        <>Line starts at <b>{r.landmark ?? '?'}</b></>
                      ) : (
                        <>
                          Waited{' '}
                          <b>
                            {r.joinedAt && r.darshanAt
                              ? Math.round(
                                  (r.darshanAt.getTime() - r.joinedAt.getTime()) / 60_000,
                                ) + ' min'
                              : '?'}
                          </b>
                          <span className="block text-xs text-stone-500">
                            {r.joinedAt ? fmtIst(r.joinedAt) : '?'} →{' '}
                            {r.darshanAt ? fmtIst(r.darshanAt) : '?'}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-500">
                      {r.heuristicLow != null ? `${r.heuristicLow}–${r.heuristicHigh} min` : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-400">
                      {r.ipHash.slice(0, 8)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <form action={moderateReport} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="decision" value="accepted" />
                        <button className="rounded bg-green-700 px-2.5 py-1 text-xs font-bold text-white">
                          Accept
                        </button>
                      </form>{' '}
                      <form action={moderateReport} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button className="rounded bg-stone-300 px-2.5 py-1 text-xs font-bold text-stone-700">
                          Reject
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">Mandals</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Mandal</th>
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Pins</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {allMandals.map((m) => {
                const qs = allQueues.filter((q) => q.mandalId === m.id);
                const pinned = qs.filter((q) => q.entryLat != null).length;
                return (
                  <tr key={m.id} className={m.isActive ? '' : 'opacity-50'}>
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2">{m.area}</td>
                    <td className="px-3 py-2 uppercase">{m.tier}</td>
                    <td className="px-3 py-2">
                      <span className={pinned === qs.length ? 'text-green-700' : 'text-amber-700'}>
                        {pinned}/{qs.length} queues
                      </span>
                      {m.idolLat == null && (
                        <span className="block text-xs text-stone-400">idol pin missing</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <form action={toggleMandal}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="active" value={String(!m.isActive)} />
                        <button
                          className={`rounded px-2.5 py-1 text-xs font-bold ${
                            m.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {m.isActive ? 'Active' : 'Hidden'}
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/m/${m.id}`}
                        className="text-xs font-bold text-maroon underline"
                      >
                        Edit / pins
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
