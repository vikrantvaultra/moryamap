import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  backHref?: string;
  backLabel?: string;
  eyebrow?: ReactNode;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header>
      {backHref && backLabel && (
        <Link href={backHref} className="text-sm font-medium text-flame hover:text-maroon">
          ← {backLabel}
        </Link>
      )}
      {eyebrow && <div className="mt-3">{eyebrow}</div>}
      <h1
        className={`${eyebrow ? 'mt-1' : 'mt-3'} text-[28px] font-bold leading-tight text-maroon sm:text-3xl`}
      >
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-[15px] leading-snug text-ink-soft">{subtitle}</p>}
      {children}
    </header>
  );
}

/** Year badge for information that isn't from the current festival. */
export function YearBadge({ year, label }: { year: number; label: string }) {
  const current = year >= 2026;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        current ? 'bg-band-green/10 text-band-green' : 'bg-amber-100 text-band-amber'
      }`}
    >
      {label}
    </span>
  );
}

export function Notice({
  children,
  tone = 'warn',
}: {
  children: ReactNode;
  tone?: 'warn' | 'info';
}) {
  return (
    <p
      className={`rounded-xl px-3.5 py-2.5 text-[13px] font-medium leading-snug ${
        tone === 'warn' ? 'bg-amber-100 text-maroon' : 'bg-cream-deep text-ink-soft'
      }`}
    >
      {children}
    </p>
  );
}
