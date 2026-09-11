import { describe, expect, it } from 'vitest';
import {
  bandFor,
  dayFactor,
  estimateWait,
  festivalDay,
  hourFactor,
  hoursLabel,
  isReportFresh,
  istHour,
} from './wait';

/** Build a UTC instant from an IST wall-clock time (IST = UTC+5:30). */
function ist(y: number, m: number, d: number, hh: number, mm = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 5.5 * 60 * 60 * 1000);
}

describe('hourFactor', () => {
  it('matches the spec table at every boundary', () => {
    expect(hourFactor(4)).toBe(0.1);
    expect(hourFactor(6)).toBe(0.1);
    expect(hourFactor(7)).toBe(0.4);
    expect(hourFactor(10)).toBe(0.4);
    expect(hourFactor(11)).toBe(0.8);
    expect(hourFactor(15)).toBe(0.8);
    expect(hourFactor(16)).toBe(1.2);
    expect(hourFactor(18)).toBe(1.2);
    expect(hourFactor(19)).toBe(1.5);
    expect(hourFactor(23)).toBe(1.5);
    expect(hourFactor(0)).toBe(0.6);
    expect(hourFactor(3)).toBe(0.6);
  });
});

describe('IST conversion', () => {
  it('computes IST hours from UTC instants, never server-local', () => {
    // 20:30 UTC on 13 Sep = 02:00 IST on 14 Sep
    expect(istHour(new Date('2026-09-13T20:30:00Z'))).toBe(2);
    // 06:30 UTC = 12:00 IST
    expect(istHour(new Date('2026-09-15T06:30:00Z'))).toBe(12);
  });

  it('rolls the festival day over at IST midnight, not UTC midnight', () => {
    expect(festivalDay(new Date('2026-09-13T18:00:00Z'))).toBeNull(); // 23:30 IST, 13 Sep
    expect(festivalDay(new Date('2026-09-13T18:31:00Z'))).toBe(1); // 00:01 IST, 14 Sep
  });
});

describe('festivalDay', () => {
  it('maps the window 14–25 Sep 2026 to days 1..12', () => {
    expect(festivalDay(ist(2026, 9, 14, 12))).toBe(1);
    expect(festivalDay(ist(2026, 9, 18, 12))).toBe(5);
    expect(festivalDay(ist(2026, 9, 25, 12))).toBe(12);
    expect(festivalDay(ist(2026, 9, 13, 12))).toBeNull();
    expect(festivalDay(ist(2026, 9, 26, 12))).toBeNull();
  });
});

describe('dayFactor — max of applicable, never multiplied', () => {
  it('day 1 (Mon 14 Sep): max(weekday 0.9, day-1 1.3) = 1.3', () => {
    expect(dayFactor(ist(2026, 9, 14, 12))).toBe(1.3);
  });
  it('day 5 (Fri 18 Sep): max(weekday 0.9, days-5-7 1.2) = 1.2', () => {
    expect(dayFactor(ist(2026, 9, 18, 12))).toBe(1.2);
  });
  it('day 6 (Sat 19 Sep): max(weekend 1.4, days-5-7 1.2) = 1.4, not 1.68', () => {
    expect(dayFactor(ist(2026, 9, 19, 12))).toBe(1.4);
  });
  it('Anant Chaturdashi (Fri 25 Sep): max(weekday 0.9, 1.6) = 1.6', () => {
    expect(dayFactor(ist(2026, 9, 25, 12))).toBe(1.6);
  });
  it('plain weekday inside the festival (Wed 16 Sep) = 0.9', () => {
    expect(dayFactor(ist(2026, 9, 16, 12))).toBe(0.9);
  });
  it('outside the festival falls back to weekday/weekend only', () => {
    expect(dayFactor(ist(2026, 10, 5, 12))).toBe(0.9); // a Monday
    expect(dayFactor(ist(2026, 10, 3, 12))).toBe(1.4); // a Saturday
  });
});

describe('estimateWait — heuristic', () => {
  it('tier S midday weekday: 240 * 0.8 * 0.9 = 172.8 → 1.5–4.5 hrs', () => {
    const est = estimateWait({ baseMinutes: 240, at: ist(2026, 9, 16, 12) });
    expect(est.provenance).toBe('estimate');
    expect(est.unit).toBe('hr');
    // ±40%: 103.68–241.92 → floor/ceil to 0.5h
    expect(est.lowMinutes).toBe(90);
    expect(est.highMinutes).toBe(270);
    expect(est.explain.hourFactor).toBe(0.8);
    expect(est.explain.dayFactor).toBe(0.9);
  });

  it('widens to ±55% when hourFactor >= 1.2', () => {
    const est = estimateWait({ baseMinutes: 240, at: ist(2026, 9, 16, 20) });
    // 240 * 1.5 * 0.9 = 324; ±55% → 145.8–502.2 → 120–510
    expect(est.explain.spread).toBe(0.55);
    expect(est.lowMinutes).toBe(120);
    expect(est.highMinutes).toBe(510);
    expect(est.band).toBe('deepred');
  });

  it('small waits round to 15-minute steps and never show a bare zero range', () => {
    // tier B early morning: 35 * 0.1 * 0.9 = 3.15 → up to 15 min
    const est = estimateWait({ baseMinutes: 35, at: ist(2026, 9, 16, 5) });
    expect(est.unit).toBe('min');
    expect(est.lowMinutes).toBe(0);
    expect(est.highMinutes).toBe(15);
    expect(est.band).toBe('green');
  });

  it('always returns a range, never a point', () => {
    for (const hour of [0, 5, 9, 13, 17, 21]) {
      for (const base of [10, 35, 90, 240, 600]) {
        const est = estimateWait({ baseMinutes: base, at: ist(2026, 9, 20, hour) });
        expect(est.highMinutes).toBeGreaterThan(est.lowMinutes);
      }
    }
  });

  it('rounding only widens: rounded bounds contain the raw ±spread bounds', () => {
    for (const hour of [3, 8, 12, 18, 22]) {
      for (const base of [10, 35, 90, 240, 600]) {
        const est = estimateWait({ baseMinutes: base, at: ist(2026, 9, 17, hour) });
        const { rawMinutes, spread } = est.explain;
        expect(est.lowMinutes).toBeLessThanOrEqual(rawMinutes * (1 - spread));
        expect(est.highMinutes).toBeGreaterThanOrEqual(rawMinutes * (1 + spread));
      }
    }
  });
});

describe('estimateWait — crowd report override', () => {
  const at = ist(2026, 9, 16, 20);

  it('uses impliedMinutes directly when a fresh accepted report exists', () => {
    const est = estimateWait({
      baseMinutes: 240,
      at,
      report: { impliedMinutes: 300, reportedAt: new Date(at.getTime() - 25 * 60_000) },
    });
    expect(est.provenance).toBe('reported');
    // ±40% of 300 → 180–420 → exactly 3–7 hrs
    expect(est.lowMinutes).toBe(180);
    expect(est.highMinutes).toBe(420);
    expect(hoursLabel(est.lowMinutes)).toBe('3');
    expect(hoursLabel(est.highMinutes)).toBe('7');
    expect(est.reportedAt).toBeDefined();
  });

  it('does NOT multiply hour/day factors on top of a report', () => {
    const est = estimateWait({
      baseMinutes: 240,
      at, // 20:00 IST → hourFactor 1.5 would inflate a naive implementation
      report: { impliedMinutes: 100, reportedAt: at },
    });
    expect(est.explain.rawMinutes).toBe(100);
  });

  it('expires reports older than 90 minutes and falls back to the heuristic', () => {
    const est = estimateWait({
      baseMinutes: 240,
      at,
      report: { impliedMinutes: 300, reportedAt: new Date(at.getTime() - 91 * 60_000) },
    });
    expect(est.provenance).toBe('estimate');
  });

  it('freshness boundary is inclusive at exactly 90 minutes', () => {
    expect(isReportFresh(new Date(at.getTime() - 90 * 60_000), at)).toBe(true);
    expect(isReportFresh(new Date(at.getTime() - 90 * 60_000 - 1000), at)).toBe(false);
  });
});

describe('bands', () => {
  it('bands by the upper bound', () => {
    expect(bandFor(45)).toBe('green');
    expect(bandFor(60)).toBe('green');
    expect(bandFor(120)).toBe('amber');
    expect(bandFor(180)).toBe('amber');
    expect(bandFor(300)).toBe('red');
    expect(bandFor(361)).toBe('deepred');
  });
});

describe('hoursLabel', () => {
  it('formats half hours and strips trailing .0', () => {
    expect(hoursLabel(90)).toBe('1.5');
    expect(hoursLabel(120)).toBe('2');
    expect(hoursLabel(270)).toBe('4.5');
  });
});
