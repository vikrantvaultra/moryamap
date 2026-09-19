/**
 * BMC wards — the browse axis for the full directory.
 *
 * "area" in the directory is free-text locality: 66 distinct values across
 * 139 mandals, which is too fine to filter by and too coarse to trust. The
 * ward is how BMC and the police actually carve up Ganeshotsav, there are
 * exactly 24 of them, and every mandal has one (scripts/assign-wards.ts).
 *
 * This module is pure and dependency-free so the map and list client
 * components can import it without dragging the directory into the bundle.
 */

/** The four browse regions the ward letters roll up into. */
export type Region = 'island' | 'western' | 'eastern' | 'mmr';

export const REGIONS: Region[] = ['island', 'western', 'eastern', 'mmr'];

/**
 * Which region a BMC ward sits in. Anything unlisted — Thane, Navi Mumbai,
 * Mira-Bhayander, Panvel, Dombivali — is outside Greater Mumbai, so 'mmr'.
 */
const REGION_BY_WARD: Record<string, Region> = {
  A: 'island',
  B: 'island',
  C: 'island',
  D: 'island',
  E: 'island',
  'F/N': 'island',
  'F/S': 'island',
  'G/N': 'island',
  'G/S': 'island',
  'H/E': 'western',
  'H/W': 'western',
  'K/E': 'western',
  'K/W': 'western',
  'P/N': 'western',
  'P/S': 'western',
  'R/C': 'western',
  'R/N': 'western',
  'R/S': 'western',
  L: 'eastern',
  'M/E': 'eastern',
  'M/W': 'eastern',
  N: 'eastern',
  S: 'eastern',
  T: 'eastern',
};

/** The localities each ward covers, so the filter chip says something useful. */
const WARD_PLACES: Record<string, string> = {
  A: 'Colaba · Fort · Churchgate',
  B: 'Dongri · Mandvi',
  C: 'Marine Lines · Kalbadevi · Bhuleshwar',
  D: 'Girgaon · Khetwadi · Grant Road · Malabar Hill',
  E: 'Byculla · Mazgaon · Kamathipura',
  'F/N': 'Matunga · Sion · Wadala',
  'F/S': 'Parel · Lalbaug · Sewri · Chinchpokli',
  'G/N': 'Dadar · Mahim · Dharavi',
  'G/S': 'Worli · Prabhadevi · Elphinstone',
  'H/E': 'Bandra East · Santacruz East · Vakola',
  'H/W': 'Bandra West · Khar · Santacruz West',
  'K/E': 'Andheri East · Jogeshwari East · Vile Parle East',
  'K/W': 'Andheri West · Juhu · Versova',
  'P/N': 'Malad',
  'P/S': 'Goregaon',
  'R/C': 'Borivali',
  'R/N': 'Dahisar',
  'R/S': 'Kandivali',
  L: 'Kurla · Chandivali · Sakinaka',
  'M/E': 'Govandi · Mankhurd · Anushakti Nagar',
  'M/W': 'Chembur · Tilak Nagar',
  N: 'Ghatkopar · Vidyavihar',
  S: 'Bhandup · Powai · Vikhroli · Kanjurmarg',
  T: 'Mulund',
};

export function regionOfWard(ward: string | null): Region {
  return (ward && REGION_BY_WARD[ward]) || 'mmr';
}

/** A single letter (or letter/direction) is a BMC ward; anything else is a city. */
export function isBmcWard(ward: string | null): boolean {
  return ward != null && ward in REGION_BY_WARD;
}

/** 'D' → 'D Ward'; 'Thane' → 'Thane'. */
export function wardLabel(ward: string | null, wardWord: string): string {
  if (!ward) return '';
  return isBmcWard(ward) ? `${ward} ${wardWord}` : ward;
}

/** 'D' → 'Girgaon · Khetwadi · …'; a city ward has no sub-list. */
export function wardPlaces(ward: string | null): string {
  return (ward && WARD_PLACES[ward]) || '';
}

/** Region first, then BMC wards alphabetically, then the MMR cities. */
export function compareWards(a: string, b: string): number {
  const ra = REGIONS.indexOf(regionOfWard(a));
  const rb = REGIONS.indexOf(regionOfWard(b));
  return ra - rb || a.localeCompare(b);
}
