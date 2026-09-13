/**
 * Hardcoded, sourced festival data (src/data/*.json). No database: every
 * record carries the id of the source it came from and the year it applies
 * to, and the UI labels anything that isn't from 2026.
 */
import immersionJson from '@/data/immersion-sites.json';
import trainsJson from '@/data/trains.json';
import visarjanJson from '@/data/visarjan.json';
import type { SourceRef } from '@/components/Sources';
import { istDateKey } from '@/lib/site';

export const CURRENT_YEAR = 2026;

export type ImmersionDayKey =
  'one_and_half_day' | 'five_day' | 'gauri' | 'seven_day' | 'anant_chaturdashi';

export interface ImmersionDate {
  date: string;
  key: ImmersionDayKey;
  sourceId: string;
}

export interface Rule {
  id: string;
  text: string;
  textMr: string | null;
  textHi: string | null;
  sourceId: string;
  year: number;
}

export interface Helpline {
  id?: string;
  name: string;
  number: string;
  sourceId: string;
}

export type SiteKind = 'artificial' | 'natural' | 'collection';

export interface ImmersionSite {
  id: string;
  kind: SiteKind;
  name: string;
  nameMr: string | null;
  ward: string | null;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  pinPrecision: 'street' | 'area' | null;
  geocodeMatch: string | null;
  sourceId: string;
  year: number;
}

export interface ImmersionData {
  retrievedAt: string;
  sources: SourceRef[];
  dates: ImmersionDate[];
  rules: Rule[];
  helplines: Helpline[];
  sites: ImmersionSite[];
}

export interface Closure {
  id: string;
  road: string;
  area: string;
  restriction: string;
  details: string;
  appliesOn: string[];
  timeWindow: string | null;
  sourceId: string;
  year: number;
}

export interface Bridge {
  id: string;
  name: string;
  area: string;
  advice: string;
  sourceId: string;
  year: number;
}

export interface Checkpoint {
  id: string;
  sequence: number;
  name: string;
  nameMr: string | null;
  lat: number | null;
  lng: number | null;
  geocodeMatch: string | null;
}

export interface VisarjanData {
  retrievedAt: string;
  sources: SourceRef[];
  closures: Closure[];
  bridges: Bridge[];
  procession: {
    mandalSlug: string;
    sourceIds: string[];
    year: number;
    checkpoints: Checkpoint[];
    facts: { text: string; sourceId: string; year: number }[];
  };
  helplines: Helpline[];
  channels: { id: string; name: string; url: string; sourceId: string }[];
}

export interface TrainSpecial {
  id: string;
  operator: string;
  night: string;
  from: string;
  to: string;
  departs: string;
  arrives: string | null;
  stopsAt: string | null;
  sourceId: string;
  year: number;
}

export interface TrainsData {
  retrievedAt: string;
  announced2026: boolean;
  sources: SourceRef[];
  specials: TrainSpecial[];
  extendedHours: {
    id: string;
    operator: string;
    dates: string;
    details: string;
    sourceId: string;
    year: number;
  }[];
  lastTrains: {
    id: string;
    station: string;
    line: string;
    direction: string;
    departs: string;
    sourceId: string;
    year: number;
  }[];
  advisories: { id: string; text: string; stations: string[]; sourceId: string; year: number }[];
}

export const immersion = immersionJson as ImmersionData;
export const visarjan = visarjanJson as VisarjanData;
export const trains = trainsJson as TrainsData;

export function sourceById(sources: SourceRef[], id: string): SourceRef | undefined {
  return sources.find((s) => s.id === id);
}

export function ruleText(rule: Rule, locale: string): string {
  if (locale === 'mr' && rule.textMr) return rule.textMr;
  if (locale === 'hi' && rule.textHi) return rule.textHi;
  return rule.text;
}

/** Immersion day happening today or tomorrow (IST), for the home banner. */
export function immersionMoment(
  now: Date,
): { when: 'today' | 'tomorrow'; day: ImmersionDate } | null {
  const today = istDateKey(now);
  const tomorrow = istDateKey(new Date(now.getTime() + 86_400_000));
  const dates = [...immersion.dates].sort((a, b) => a.date.localeCompare(b.date));
  const t = dates.find((d) => d.date === today);
  if (t) return { when: 'today', day: t };
  const tm = dates.find((d) => d.date === tomorrow);
  if (tm) return { when: 'tomorrow', day: tm };
  return null;
}

export function dayStatus(date: string, now: Date): 'past' | 'today' | 'tomorrow' | 'upcoming' {
  const today = istDateKey(now);
  const tomorrow = istDateKey(new Date(now.getTime() + 86_400_000));
  if (date === today) return 'today';
  if (date === tomorrow) return 'tomorrow';
  return date < today ? 'past' : 'upcoming';
}
