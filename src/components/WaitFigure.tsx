import { getTranslations } from 'next-intl/server';
import { hoursLabel, type WaitEstimate } from '@/lib/wait';

const BAND_BG: Record<WaitEstimate['band'], string> = {
  green: 'bg-band-green',
  amber: 'bg-band-amber',
  red: 'bg-band-red',
  deepred: 'bg-band-deepred',
};

export function formatRangeParts(est: WaitEstimate) {
  if (est.unit === 'hr') {
    return { key: 'hours' as const, low: hoursLabel(est.lowMinutes), high: hoursLabel(est.highMinutes) };
  }
  if (est.lowMinutes === 0) {
    return { key: 'minutesUpTo' as const, low: '0', high: String(est.highMinutes) };
  }
  return { key: 'minutes' as const, low: String(est.lowMinutes), high: String(est.highMinutes) };
}

/**
 * The one true wait display. Every wait figure in the app renders through
 * this (or its client twin on the map) so the honesty rules hold everywhere:
 * always a range, always a provenance label, always the disclaimer.
 */
export default async function WaitFigure({
  est,
  landmark,
  size = 'md',
}: {
  est: WaitEstimate;
  /** For reported waits: where the line was said to start. */
  landmark?: string | null;
  size?: 'md' | 'lg';
}) {
  const t = await getTranslations('wait');
  const tb = await getTranslations('bands');

  const parts = formatRangeParts(est);
  const range = t(parts.key, { low: parts.low, high: parts.high });

  let provenance: string;
  if (est.provenance === 'reported' && est.reportedAt) {
    const mins = Math.max(0, Math.round((Date.now() - est.reportedAt.getTime()) / 60_000));
    provenance = mins < 1 ? t('reportedJustNow') : t('reportedLabel', { mins });
  } else {
    provenance = t('estimateLabel');
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`${BAND_BG[est.band]} rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white`}
        >
          {tb(est.band)}
        </span>
        <span
          className={`font-bold tabular-nums text-ink ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}
        >
          {range}
        </span>
      </div>
      <p
        className={`text-xs font-medium ${
          est.provenance === 'reported' ? 'text-band-green' : 'text-ink-soft'
        }`}
      >
        {est.provenance === 'reported' ? '● ' : ''}
        {provenance}
      </p>
      {est.provenance === 'reported' && landmark ? (
        <p className="text-xs text-ink-soft">{t('lineStartsAt', { landmark })}</p>
      ) : null}
      <p className="text-xs italic text-ink-soft/90">{t('disclaimer')}</p>
    </div>
  );
}
