import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { mandalName } from '@/lib/names';
import { getQueueContext } from '@/lib/queries';

export const revalidate = 60;

const OUTCOMES = ['sent', 'sent-times', 'limited', 'invalid'] as const;
type Outcome = (typeof OUTCOMES)[number];

export function generateStaticParams() {
  return OUTCOMES.map((outcome) => ({ outcome }));
}

const STYLE: Record<Outcome, { icon: string; tone: string }> = {
  sent: { icon: '🙏', tone: 'text-band-green' },
  'sent-times': { icon: '🙏', tone: 'text-band-green' },
  limited: { icon: '⏳', tone: 'text-band-amber' },
  invalid: { icon: '⚠️', tone: 'text-band-red' },
};

export default async function ReportOutcomePage({
  params,
}: {
  params: Promise<{ locale: string; queueId: string; outcome: string }>;
}) {
  const { locale, queueId: rawId, outcome } = await params;
  setRequestLocale(locale);
  if (!(OUTCOMES as readonly string[]).includes(outcome)) notFound();
  const queueId = Number(rawId);
  if (!Number.isInteger(queueId)) notFound();
  const ctx = await getQueueContext(queueId);
  if (!ctx) notFound();

  const t = await getTranslations('report');
  const tc = await getTranslations('common');
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const o = outcome as Outcome;

  const message =
    o === 'sent' || o === 'sent-times'
      ? t('thanks')
      : o === 'limited'
        ? t('rateLimited')
        : t('invalid');

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      <div className="text-5xl" aria-hidden>
        {STYLE[o].icon}
      </div>
      <p className={`mx-auto mt-4 max-w-sm text-base font-semibold ${STYLE[o].tone}`}>{message}</p>
      <div className="mt-8 flex flex-col items-center gap-2">
        {o === 'invalid' && (
          <Link
            href={`${prefix}/report/${queueId}`}
            className="w-full max-w-xs rounded-xl bg-maroon px-4 py-2.5 text-sm font-bold text-amber-50"
          >
            ← {t('title')}
          </Link>
        )}
        <Link
          href={`${prefix}/m/${ctx.mandal.slug}`}
          className="w-full max-w-xs rounded-xl border-2 border-maroon px-4 py-2.5 text-sm font-bold text-maroon"
        >
          {mandalName(ctx.mandal, locale)}
        </Link>
        <Link
          href={prefix || '/'}
          className="w-full max-w-xs rounded-xl bg-cream-deep px-4 py-2.5 text-sm font-semibold text-ink-soft"
        >
          {tc('backToMap')}
        </Link>
      </div>
    </div>
  );
}
