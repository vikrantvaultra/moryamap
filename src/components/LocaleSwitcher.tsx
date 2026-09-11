'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
] as const;

/**
 * Deliberately provider-free (plain next/link + manual prefix handling) so
 * static pages ship no next-intl client runtime or messages.
 */
export default function LocaleSwitcher({ current }: { current: string }) {
  const pathname = usePathname() ?? '/';
  const rest = pathname.replace(/^\/(mr|hi)(?=\/|$)/, '') || '/';

  return (
    <nav aria-label="Language" className="flex items-center gap-0.5 rounded-full bg-cream-deep p-0.5">
      {LOCALES.map((l) => {
        // Locale detection is off, so plain paths are stable: unprefixed =
        // English (the default), /mr and /hi carry the explicit choice.
        const href = l.code === 'en' ? rest : `/${l.code}${rest === '/' ? '' : rest}`;
        const active = l.code === current;
        return (
          <Link
            key={l.code}
            href={href}
            aria-current={active ? 'true' : undefined}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              active ? 'bg-maroon text-amber-100 shadow-sm' : 'text-ink-soft hover:text-maroon'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
