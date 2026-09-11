/**
 * The wait estimator. Pure functions only — no DB, no I/O, fully explainable.
 *
 * waitMinutes = baseMinutes * hourFactor(istHour) * dayFactor(date)
 *
 * Honesty rules enforced here:
 *  - Output is always a RANGE, never a single number.
 *  - Provenance is always attached ('estimate' | 'reported').
 *  - Crowd reports expire after 90 minutes → fall back to the heuristic.
 */

export type Provenance = 'estimate' | 'reported';
export type WaitBand = 'green' | 'amber' | 'red' | 'deepred';

export interface AcceptedEntryPointReport {
  /** Rough wait implied by where the line currently starts. */
  impliedMinutes: number;
  reportedAt: Date;
}

export interface WaitEstimate {
  /** Rounded lower bound, in minutes. May be 0 ("up to X"). */
  lowMinutes: number;
  /** Rounded upper bound, in minutes. */
  highMinutes: number;
  /** Display unit the bounds were rounded for. */
  unit: 'min' | 'hr';
  provenance: Provenance;
  /** Present when provenance === 'reported'. */
  reportedAt?: Date;
  band: WaitBand;
  /** Unrounded midpoint + inputs, kept for the calibration paper trail. */
  explain: {
    rawMinutes: number;
    baseMinutes: number;
    hourFactor: number;
    dayFactor: number;
    spread: number;
  };
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const REPORT_FRESHNESS_MINUTES = 90;

/** Festival window, IST dates. Day 1 = Chaturthi, day 12 = Anant Chaturdashi. */
export const FESTIVAL_DAYS = 12;
const FESTIVAL_START_UTC_DAY = Date.UTC(2026, 8, 14); // 14 Sep 2026

/**
 * Shift an instant so that getUTC*() reads give IST wall-clock values.
 * IST is a fixed UTC+5:30 with no DST, so plain offset math is correct.
 * Never use the server's local zone — Vercel functions run in UTC.
 */
export function toIst(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

export function istHour(date: Date): number {
  return toIst(date).getUTCHours();
}

export function hourFactor(hour: number): number {
  if (hour >= 4 && hour < 7) return 0.1;
  if (hour >= 7 && hour < 11) return 0.4;
  if (hour >= 11 && hour < 16) return 0.8;
  if (hour >= 16 && hour < 19) return 1.2;
  if (hour >= 19) return 1.5; // 19:00–24:00
  return 0.6; // 00:00–04:00
}

/** 1..12 during the festival, null outside it. */
export function festivalDay(date: Date): number | null {
  const ist = toIst(date);
  const istDay = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const day = Math.floor((istDay - FESTIVAL_START_UTC_DAY) / 86_400_000) + 1;
  return day >= 1 && day <= FESTIVAL_DAYS ? day : null;
}

/** Max of every applicable factor — never multiplied together. */
export function dayFactor(date: Date): number {
  const ist = toIst(date);
  const dow = ist.getUTCDay();
  const factors = [dow === 0 || dow === 6 ? 1.4 : 0.9];
  const day = festivalDay(date);
  if (day === 1) factors.push(1.3);
  if (day !== null && day >= 5 && day <= 7) factors.push(1.2);
  if (day === FESTIVAL_DAYS) factors.push(1.6);
  return Math.max(...factors);
}

export function isReportFresh(reportedAt: Date, at: Date): boolean {
  const ageMinutes = (at.getTime() - reportedAt.getTime()) / 60_000;
  return ageMinutes >= 0 && ageMinutes <= REPORT_FRESHNESS_MINUTES;
}

export interface EstimateInput {
  baseMinutes: number;
  at?: Date;
  /** Most recent ACCEPTED entry_point report for this queue, if any. */
  report?: AcceptedEntryPointReport | null;
}

export function estimateWait({ baseMinutes, at = new Date(), report }: EstimateInput): WaitEstimate {
  if (report && isReportFresh(report.reportedAt, at)) {
    // A fresh entry-point report describes the queue's physical length right
    // now. The hour/day factors exist to predict that length, so applying
    // them on top would double-count. Use impliedMinutes directly — blend
    // nothing, keep it explainable.
    return build(report.impliedMinutes, 0.4, 'reported', {
      baseMinutes,
      hourFactor: 1,
      dayFactor: 1,
      reportedAt: report.reportedAt,
    });
  }
  const hf = hourFactor(istHour(at));
  const df = dayFactor(at);
  const spread = hf >= 1.2 ? 0.55 : 0.4;
  return build(baseMinutes * hf * df, spread, 'estimate', {
    baseMinutes,
    hourFactor: hf,
    dayFactor: df,
  });
}

function build(
  rawMinutes: number,
  spread: number,
  provenance: Provenance,
  meta: { baseMinutes: number; hourFactor: number; dayFactor: number; reportedAt?: Date },
): WaitEstimate {
  const rawLow = rawMinutes * (1 - spread);
  const rawHigh = rawMinutes * (1 + spread);

  let lowMinutes: number;
  let highMinutes: number;
  let unit: 'min' | 'hr';
  if (rawHigh >= 90) {
    // Hours, rounded to 0.5 h. Floor the low and ceil the high so rounding
    // only ever widens the range — never narrows it.
    unit = 'hr';
    lowMinutes = Math.floor(rawLow / 30) * 30;
    highMinutes = Math.ceil(rawHigh / 30) * 30;
  } else {
    unit = 'min';
    lowMinutes = Math.floor(rawLow / 15) * 15;
    highMinutes = Math.max(15, Math.ceil(rawHigh / 15) * 15);
  }
  if (highMinutes <= lowMinutes) highMinutes = lowMinutes + (unit === 'hr' ? 30 : 15);

  return {
    lowMinutes,
    highMinutes,
    unit,
    provenance,
    ...(meta.reportedAt ? { reportedAt: meta.reportedAt } : {}),
    band: bandFor(highMinutes),
    explain: {
      rawMinutes,
      baseMinutes: meta.baseMinutes,
      hourFactor: meta.hourFactor,
      dayFactor: meta.dayFactor,
      spread,
    },
  };
}

/** Band by the UPPER bound — planning for the worst case is the honest read. */
export function bandFor(highMinutes: number): WaitBand {
  if (highMinutes <= 60) return 'green';
  if (highMinutes <= 180) return 'amber';
  if (highMinutes <= 360) return 'red';
  return 'deepred';
}

/** "90" → "1.5", "120" → "2" — hour values without trailing .0 */
export function hoursLabel(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(/\.0$/, '');
}
