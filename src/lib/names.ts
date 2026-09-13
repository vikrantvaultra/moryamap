import type { PinPrecision } from '@/lib/queries';

/** Locale-aware display names with graceful fallback to English. */

export function mandalName(
  m: { name: string; nameMr: string | null; nameHi: string | null },
  locale: string,
): string {
  if (locale === 'mr' && m.nameMr) return m.nameMr;
  if (locale === 'hi' && m.nameHi) return m.nameHi;
  return m.name;
}

/** Queue labels are Devanagari for both mr and hi (mukh darshan etc.). */
export function queueLabel(q: { label: string; labelMr: string | null }, locale: string): string {
  if ((locale === 'mr' || locale === 'hi') && q.labelMr) return q.labelMr;
  return q.label;
}

export function landmarkName(
  ep: { landmark: string; landmarkMr: string | null },
  locale: string,
): string {
  if ((locale === 'mr' || locale === 'hi') && ep.landmarkMr) return ep.landmarkMr;
  return ep.landmark;
}

/** Message key (home.*) describing how far to trust a mandal pin. */
export function pinLabelKey(
  precision: PinPrecision | null,
): 'mandalLocation' | 'approxLocation' | 'areaOnly' {
  if (precision === 'rooftop') return 'mandalLocation';
  if (precision === 'area') return 'areaOnly';
  return 'approxLocation';
}
