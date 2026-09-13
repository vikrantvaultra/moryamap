import type { MandalData } from '@/lib/queries';

/**
 * Pandal-hopping routes: curated circuits + user-built plans.
 *
 * Safety rules (same spirit as the list):
 *  - Stops are ordered by GEOGRAPHY, never by current wait.
 *  - Distances are straight-line and labelled as such — real walks are longer.
 *  - Approximate pins stay flagged as approximate on every stop.
 */

export const MAX_STOPS = 8;
export const MIN_STOPS = 2;

type L10n = { en: string; mr: string; hi: string };

export interface Circuit {
  id: string;
  title: L10n;
  /** Geography only — no unsourced claims about the mandals themselves. */
  blurb: L10n;
  /** Mandal slugs in walking order. */
  stops: string[];
}

export const CIRCUITS: Circuit[] = [
  {
    id: 'lalbaug-parel',
    title: {
      en: 'Lalbaug–Parel night circuit',
      mr: 'लालबाग–परळ रात्रीची फेरी',
      hi: 'लालबाग–परेल रात की फेरी',
    },
    blurb: {
      en: 'The famous Lalbaug cluster, walked north to south from Parel and ending near Chinchpokli station.',
      mr: 'लालबागमधील प्रसिद्ध मंडळे — परळपासून दक्षिणेकडे चालत, चिंचपोकळी स्टेशनजवळ शेवट.',
      hi: 'लालबाग के प्रसिद्ध मंडल — परेल से दक्षिण की ओर पैदल, चिंचपोकली स्टेशन के पास अंत।',
    },
    stops: [
      'parel-cha-raja',
      'mumbaicha-raja',
      'tejukaya',
      'lalbaugcha-raja',
      'chinchpoklicha-chintamani',
    ],
  },
  {
    id: 'girgaon-khetwadi',
    title: {
      en: 'Khetwadi–Girgaon lanes',
      mr: 'खेतवाडी–गिरगाव गल्ल्या',
      hi: 'खेतवाड़ी–गिरगांव की गलियाँ',
    },
    blurb: {
      en: 'Tightly packed mandals in the old wadis between Grant Road and Marine Lines stations.',
      mr: 'ग्रँट रोड आणि मरीन लाइन्स स्टेशनदरम्यानच्या जुन्या वाड्यांमधील जवळजवळची मंडळे.',
      hi: 'ग्रांट रोड और मरीन लाइंस स्टेशनों के बीच पुरानी वाड़ियों में पास-पास के मंडल।',
    },
    stops: [
      'khetwadicha-ganraj',
      'mumbaicha-maharaja',
      'girgaoncha-raja',
      'keshavji-naik-chawl',
      'jitekar-wadi-sarvajanik-ganeshotsav-mandal',
      'akhil-chandanwadi-ganeshotsav-mandal',
    ],
  },
  {
    id: 'tardeo-dongri',
    title: {
      en: 'Tardeo–Kamathipura–Dongri',
      mr: 'ताडदेव–कामाठीपुरा–डोंगरी',
      hi: 'ताड़देव–कामाठीपुरा–डोंगरी',
    },
    blurb: {
      en: 'West to east across central Mumbai, from Tardeo past Grant Road to Dongri near Sandhurst Road.',
      mr: 'मध्य मुंबईतून पश्चिम ते पूर्व — ताडदेवपासून ग्रँट रोडमार्गे सँडहर्स्ट रोडजवळील डोंगरीपर्यंत.',
      hi: 'मध्य मुंबई में पश्चिम से पूर्व — ताड़देव से ग्रांट रोड होते हुए सैंडहर्स्ट रोड के पास डोंगरी तक।',
    },
    stops: [
      'tulshiwadi-sarvajanik-ganeshotsav-mandal',
      'grant-road-cha-raja-sarvajanik-ganesh-utsav-mandal',
      'kamathipuracha-maharaja',
      'dongri-cha-raja',
    ],
  },
  {
    id: 'kings-circle-wadala',
    title: {
      en: "King's Circle–Wadala GSB pair",
      mr: 'किंग्ज सर्कल–वडाळा जीएसबी जोडी',
      hi: 'किंग्स सर्कल–वडाला जीएसबी जोड़ी',
    },
    blurb: {
      en: "The two GSB mandals, a short hop apart between King's Circle and Wadala.",
      mr: 'किंग्ज सर्कल आणि वडाळ्यादरम्यान जवळजवळ असलेली दोन जीएसबी मंडळे.',
      hi: 'किंग्स सर्कल और वडाला के बीच पास-पास के दो जीएसबी मंडल।',
    },
    stops: ['gsb-seva-mandal', 'gsb-sarvajanik-ganeshotsava-samiti-wadala'],
  },
  {
    id: 'andheri-vile-parle',
    title: {
      en: 'Andheri–Vile Parle suburbs',
      mr: 'अंधेरी–विलेपार्ले उपनगर',
      hi: 'अंधेरी–विले पार्ले उपनगर',
    },
    blurb: {
      en: 'Western suburbs: Andheri West across the tracks to Andheri East, then south to Vile Parle.',
      mr: 'पश्चिम उपनगरे: अंधेरी पश्चिमहून रूळ ओलांडून अंधेरी पूर्व, मग दक्षिणेला विलेपार्ले.',
      hi: 'पश्चिमी उपनगर: अंधेरी पश्चिम से पटरियाँ पार कर अंधेरी पूर्व, फिर दक्षिण में विले पार्ले।',
    },
    stops: [
      'andhericha-raja',
      'navsala-pavnara-andhericha-maharaja',
      'andheri-cha-morya',
      'vile-parle-cha-vighnesh-sarvajanik-ganeshotsav-mandal',
    ],
  },
];

export function l10n(v: L10n, locale: string): string {
  return locale === 'mr' ? v.mr : locale === 'hi' ? v.hi : v.en;
}

export function getCircuit(id: string): Circuit | null {
  return CIRCUITS.find((c) => c.id === id) ?? null;
}

export type PinnedMandal = MandalData & { idolLat: number; idolLng: number };

export function isPinned(m: MandalData): m is PinnedMandal {
  return m.idolLat != null && m.idolLng != null;
}

/** "1-2-7" → [1, 2, 7]. Null for malformed, duplicate or out-of-range input. */
export function parseStopIds(param: string): number[] | null {
  if (!/^\d{1,5}(-\d{1,5}){1,7}$/.test(param)) return null;
  const ids = param.split('-').map(Number);
  if (new Set(ids).size !== ids.length) return null;
  if (ids.length < MIN_STOPS || ids.length > MAX_STOPS) return null;
  return ids;
}

export function stopsParam(ids: number[]): string {
  return ids.join('-');
}

export function resolveCircuit(c: Circuit, directory: MandalData[]): PinnedMandal[] {
  return c.stops
    .map((slug) => directory.find((m) => m.slug === slug))
    .filter((m): m is MandalData => m != null)
    .filter(isPinned);
}

export function resolveIds(ids: number[], directory: MandalData[]): PinnedMandal[] | null {
  const stops = ids.map((id) => directory.find((m) => m.id === id));
  if (stops.some((m) => m == null || !isPinned(m))) return null;
  return stops as PinnedMandal[];
}

type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const at = (m: { idolLat: number; idolLng: number }): LatLng => ({
  lat: m.idolLat,
  lng: m.idolLng,
});

/** Straight-line km for each leg (length = stops - 1). */
export function legKm(stops: { idolLat: number; idolLng: number }[]): number[] {
  return stops.slice(1).map((s, i) => haversineKm(at(stops[i]), at(s)));
}

/** "0.4 km" / "1.6 km" — one decimal, never pretending to be precise. */
export function kmLabel(km: number): string {
  return `${Math.max(0.1, Math.round(km * 10) / 10).toFixed(1)} km`;
}

/**
 * Greedy nearest-neighbour from the first stop. Geography only — this is
 * the one reorder we offer, and it never looks at queue lengths.
 */
export function orderByGeography<T extends { idolLat: number; idolLng: number }>(stops: T[]): T[] {
  if (stops.length <= 2) return stops;
  const rest = stops.slice(1);
  const out = [stops[0]];
  while (rest.length) {
    const last = out[out.length - 1];
    let best = 0;
    for (let i = 1; i < rest.length; i++) {
      if (haversineKm(at(last), at(rest[i])) < haversineKm(at(last), at(rest[best]))) best = i;
    }
    out.push(rest.splice(best, 1)[0]);
  }
  return out;
}

const coord = (m: { idolLat: number; idolLng: number }) => `${m.idolLat},${m.idolLng}`;

/** Walking directions for one leg. */
export function legDirectionsUrl(
  from: { idolLat: number; idolLng: number },
  to: { idolLat: number; idolLng: number },
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${coord(from)}&destination=${coord(to)}&travelmode=walking`;
}

/** From the user's current location to the first stop. */
export function startDirectionsUrl(first: { idolLat: number; idolLng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coord(first)}&travelmode=transit`;
}

/**
 * Whole-route links. Google Maps URLs allow only 3 waypoints in mobile
 * browsers, so long routes are split into overlapping chunks of ≤5 stops.
 */
export function routeDirectionsChunks(
  stops: { idolLat: number; idolLng: number }[],
): { from: number; to: number; url: string }[] {
  const chunks: { from: number; to: number; url: string }[] = [];
  for (let start = 0; start < stops.length - 1; start += 4) {
    const end = Math.min(start + 4, stops.length - 1);
    const slice = stops.slice(start, end + 1);
    const waypoints = slice.slice(1, -1).map(coord).join('|');
    chunks.push({
      from: start + 1,
      to: end + 1,
      url:
        `https://www.google.com/maps/dir/?api=1&origin=${coord(slice[0])}` +
        `&destination=${coord(slice[slice.length - 1])}` +
        (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
        '&travelmode=walking',
    });
  }
  return chunks;
}

/** Circuits that include a given mandal — for "part of this route" links. */
export function circuitsContaining(slug: string): Circuit[] {
  return CIRCUITS.filter((c) => c.stops.includes(slug));
}

/** Image routes accept either a circuit id or a "1-2-7" stop list. */
export function resolveRouteKey(
  key: string,
  directory: MandalData[],
): { circuit: Circuit | null; stops: PinnedMandal[] } | null {
  const circuit = getCircuit(key);
  if (circuit) {
    const stops = resolveCircuit(circuit, directory);
    return stops.length >= MIN_STOPS ? { circuit, stops } : null;
  }
  const ids = parseStopIds(key);
  const stops = ids ? resolveIds(ids, directory) : null;
  return stops ? { circuit: null, stops } : null;
}
