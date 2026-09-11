import { getTranslations } from 'next-intl/server';
import { formatRangeParts } from '@/components/WaitFigure';
import type { WaitEstimate } from '@/lib/wait';

const BAND_DOT: Record<WaitEstimate['band'], string> = {
  green: 'bg-band-green',
  amber: 'bg-band-amber',
  red: 'bg-band-red',
  deepred: 'bg-band-deepred',
};

/** Compact one-line wait for list rows — still range + provenance, always. */
export default async function WaitChip({ est }: { est: WaitEstimate }) {
  const t = await getTranslations('wait');
  const parts = formatRangeParts(est);
  const range = t(parts.key, { low: parts.low, high: parts.high });
  const provenance =
    est.provenance === 'reported' && est.reportedAt
      ? t('reportedShort', {
          mins: Math.max(1, Math.round((Date.now() - est.reportedAt.getTime()) / 60_000)),
        })
      : t('estimateShort');

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-sm">
      <span className={`size-2.5 shrink-0 rounded-full ${BAND_DOT[est.band]}`} aria-hidden />
      <span className="font-bold tabular-nums text-ink">{range}</span>
      <span
        className={`text-xs ${est.provenance === 'reported' ? 'font-medium text-band-green' : 'text-ink-soft'}`}
      >
        · {provenance}
      </span>
    </span>
  );
}
