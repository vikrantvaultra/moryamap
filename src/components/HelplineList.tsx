import PagedList, { type PaginationLabels } from '@/components/Pagination';
import { Cite } from '@/components/Sources';
import type { Helpline } from '@/lib/festival-data';

/**
 * Tap-to-call helplines. Some ward control rooms list up to four numbers
 * ("022-… / 022-… / 98…"), so numbers wrap as chips under the name instead
 * of squeezing into a column that overflows a phone screen.
 */
export default function HelplineList({
  helplines,
  indexOf,
  callLabel,
  pagination,
}: {
  helplines: Helpline[];
  indexOf: (sourceId: string) => number;
  callLabel: string;
  pagination: PaginationLabels;
}) {
  return (
    <PagedList className="mt-3 grid gap-2 sm:grid-cols-2" pageSize={8} labels={pagination}>
      {helplines.map((h) => (
        <li key={h.id ?? `${h.name}-${h.number}`} className="card min-w-0 p-3.5">
          <p className="text-sm leading-snug text-ink">
            {h.name}
            <Cite index={indexOf(h.sourceId)} id={h.sourceId} />
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {h.number
              .split(/[/,]/)
              .map((n) => n.trim())
              .filter(Boolean)
              .map((n) => (
                <a
                  key={n}
                  href={`tel:${n.replace(/[^\d+]/g, '')}`}
                  aria-label={`${callLabel} ${n}`}
                  className="rounded-full bg-maroon px-3 py-1.5 text-sm font-bold tabular-nums text-amber-50 hover:bg-maroon-deep"
                >
                  📞 {n}
                </a>
              ))}
          </div>
        </li>
      ))}
    </PagedList>
  );
}
