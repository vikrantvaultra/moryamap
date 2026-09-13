import { getTranslations } from 'next-intl/server';
import { formatDateKey } from '@/lib/site';

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  url: string;
  year: number;
  note?: string;
}

/** Numbered source list. Only the sources actually cited on the page. */
export default async function Sources({
  sources,
  retrievedAt,
  locale,
}: {
  sources: SourceRef[];
  retrievedAt: string;
  locale: string;
}) {
  const t = await getTranslations('sources');
  if (sources.length === 0) return null;
  return (
    <section className="mt-8 border-t border-amber-900/10 pt-5" id="sources">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{t('title')}</h2>
      <p className="mt-1 text-xs text-ink-soft">
        {t('compiled', { date: formatDateKey(retrievedAt, locale) })}
      </p>
      <ol className="mt-3 space-y-2">
        {sources.map((s, i) => (
          <li
            key={s.id}
            id={`src-${s.id}`}
            className="flex gap-2 text-xs leading-snug text-ink-soft"
          >
            <span className="shrink-0 font-bold text-maroon">[{i + 1}]</span>
            <span className="min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words font-semibold text-flame underline decoration-flame/30 hover:text-maroon"
              >
                {s.title}
              </a>{' '}
              · {s.publisher}, {s.year}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Inline "[3]" citation that jumps to the source list. */
export function Cite({ index, id }: { index: number; id: string }) {
  if (index < 0) return null;
  return (
    <a
      href={`#src-${id}`}
      className="ml-1 align-super text-[10px] font-bold text-flame no-underline hover:text-maroon"
    >
      [{index + 1}]
    </a>
  );
}

/** Keep only cited sources, in first-citation order, and index them. */
export function citedSources<T extends { id: string }>(all: T[], citedIds: string[]) {
  const order: string[] = [];
  for (const id of citedIds) if (!order.includes(id)) order.push(id);
  const list = order.map((id) => all.find((s) => s.id === id)).filter((s): s is T => s != null);
  const indexOf = (id: string) => list.findIndex((s) => s.id === id);
  return { list, indexOf };
}
