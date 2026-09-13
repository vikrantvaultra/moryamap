import type { MandalData } from './queries';

/** Every mandal unique and on the map — the import refuses to write otherwise. */
export function directoryProblems(dir: MandalData[]): string[] {
  const problems: string[] = [];
  const unique = (label: string, key: (m: MandalData) => string | null) => {
    const seen = new Map<string, string>();
    for (const m of dir) {
      const k = key(m);
      if (k == null) continue;
      const prev = seen.get(k);
      if (prev) problems.push(`duplicate ${label}: ${prev} and ${m.slug}`);
      else seen.set(k, m.slug);
    }
  };
  unique('id', (m) => String(m.id));
  unique('slug', (m) => m.slug);
  unique('name', (m) => m.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  unique('address', (m) => m.address?.toLowerCase() ?? null);
  unique('pin', (m) => (m.idolLat == null ? null : `${m.idolLat.toFixed(5)},${m.idolLng!.toFixed(5)}`));
  const queueIds = new Set<number>();
  for (const m of dir) {
    if (m.idolLat == null || m.idolLng == null) problems.push(`no map pin: ${m.slug}`);
    for (const q of m.queues) {
      if (queueIds.has(q.id)) problems.push(`duplicate queue id ${q.id}: ${m.slug}`);
      queueIds.add(q.id);
    }
  }
  return problems;
}
