import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ASHIRWAD_LINK } from '@/components/ToolsNav';
import { daysUntilVisarjan } from '@/lib/ashirwad';

/**
 * The invitation to /ashirwad, on the home list and every mandal page.
 * Callers render it only when ashirwadOpen() — an invitation to something
 * that can't be received is worse than none.
 */
export default async function AshirwadPromo({ className = '' }: { className?: string }) {
  const t = await getTranslations('ashirwadPromo');
  const bappaHome = daysUntilVisarjan() < 0;
  return (
    <Link
      href={ASHIRWAD_LINK.href}
      className={`ashirwad-sanctum relative block overflow-hidden rounded-2xl p-4 text-amber-50 shadow-lg shadow-maroon/30 ring-1 ring-amber-300/30 ${className}`}
    >
      <div aria-hidden className="ashirwad-aura absolute -right-10 -top-10 size-40 rounded-full" />
      <div className="relative flex items-start gap-3">
        <span aria-hidden className="ashirwad-flicker text-3xl">
          🪔
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-bold leading-snug">{t('title')}</span>
          <span className="mt-1 block text-sm leading-relaxed text-amber-100/85">
            {t(bappaHome ? 'bodyAfter' : 'body')}
          </span>
          <span className="mt-2 inline-block text-sm font-bold text-marigold">{t('cta')}</span>
        </span>
      </div>
    </Link>
  );
}
