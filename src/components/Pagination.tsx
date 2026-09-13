'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

export interface PaginationLabels {
  /** "Page {page} of {total}" */
  pageOf: string;
  prev: string;
  next: string;
}

/** ‹ Page 2 of 7 › — same look as the home mandal list. */
export function Pagination({
  page,
  totalPages,
  onChange,
  labels,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  labels: PaginationLabels;
}) {
  if (totalPages <= 1) return null;
  const btn =
    'grid size-10 place-items-center rounded-full bg-cream-deep text-lg font-bold text-maroon disabled:opacity-30';
  return (
    <nav className="mt-4 flex items-center justify-center gap-3" aria-label={labels.pageOf}>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={btn}
        aria-label={labels.prev}
      >
        ‹
      </button>
      <span className="text-sm font-semibold tabular-nums text-ink-soft" aria-live="polite">
        {labels.pageOf.replace('{page}', String(page)).replace('{total}', String(totalPages))}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={btn}
        aria-label={labels.next}
      >
        ›
      </button>
    </nav>
  );
}

/**
 * Page state for a list. Resets to page 1 whenever `resetKey` changes
 * (search text, filters) and scrolls the list's top into view on page turns.
 */
export function usePaged<T>(items: T[], pageSize: number, resetKey: unknown = null) {
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);

  useEffect(() => setPage(1), [resetKey]);

  const goTo = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return {
    page: current,
    totalPages,
    goTo,
    topRef,
    slice: items.slice((current - 1) * pageSize, current * pageSize),
  };
}

/**
 * Paginates already-rendered items (e.g. server-rendered <li> cards), so
 * server components can hand long lists to it without shipping data twice.
 */
export default function PagedList({
  children,
  pageSize,
  labels,
  className,
}: {
  children: ReactNode;
  pageSize: number;
  labels: PaginationLabels;
  className?: string;
}) {
  const items = Children.toArray(children);
  const { page, totalPages, goTo, topRef, slice } = usePaged(items, pageSize);
  return (
    <div ref={topRef} className="scroll-mt-20">
      <ul className={className}>{slice}</ul>
      <Pagination page={page} totalPages={totalPages} onChange={goTo} labels={labels} />
    </div>
  );
}
