import { hoursLabel, type WaitEstimate } from '@/lib/wait';
import type { MandalData } from '@/lib/queries';
import { estimateForQueue } from '@/lib/queries';
import { kmLabel, legKm, type PinnedMandal } from '@/lib/routes';
import { istDay, istTime } from '@/lib/site';
import { Brand, C, Garland, OgFrame, Pill, displayHost, latin } from '@/lib/og';

/** Card bodies for every shareable image. English-only — see lib/og.tsx. */

const TIER_LABEL: Record<string, string> = {
  s: 'Legendary',
  a: 'Major',
  b: 'Popular',
  c: 'Neighbourhood',
};

const BAND_LABEL: Record<WaitEstimate['band'], string> = {
  green: 'Short',
  amber: 'Moderate',
  red: 'Long',
  deepred: 'Very long',
};

export function rangeEn(est: WaitEstimate): string {
  if (est.unit === 'hr') return `${hoursLabel(est.lowMinutes)}–${hoursLabel(est.highMinutes)} hrs`;
  if (est.lowMinutes === 0) return `up to ${est.highMinutes} min`;
  return `${est.lowMinutes}–${est.highMinutes} min`;
}

function stampEn(now: Date): string {
  return `${istDay(now)}, ${istTime(now)} IST`;
}

export function MandalCard({ mandal, now }: { mandal: MandalData; now: Date }) {
  const queues = mandal.queues.slice(0, 2).map((q) => ({ q, est: estimateForQueue(q, now) }));
  const name = latin(mandal.name);
  return (
    <OgFrame footer={`Estimate made ${stampEn(now)} · not live`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Pill bg={C.creamDeep} color={C.inkSoft} size={20}>
          {mandal.area}
        </Pill>
        <Pill
          bg={mandal.tier === 's' ? C.maroon : mandal.tier === 'a' ? C.flame : C.marigold}
          size={20}
        >
          {TIER_LABEL[mandal.tier]}
        </Pill>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: name.length > 34 ? 52 : 68,
          fontWeight: 700,
          color: C.maroon,
          lineHeight: 1.05,
          marginTop: 10,
        }}
      >
        {name}
      </div>
      {mandal.nearestStation && (
        <div style={{ display: 'flex', fontSize: 26, color: C.inkSoft, marginTop: 6 }}>
          Nearest station: {mandal.nearestStation}
        </div>
      )}
      <div style={{ display: 'flex', gap: 20, marginTop: 'auto', marginBottom: 26 }}>
        {queues.map(({ q, est }) => (
          <div
            key={q.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              backgroundColor: '#fff',
              border: '2px solid #f0e4d3',
              borderRadius: 24,
              padding: '16px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Pill bg={C.band[est.band]} size={18}>
                {BAND_LABEL[est.band]}
              </Pill>
              <span style={{ fontSize: 24, color: C.inkSoft }}>{latin(q.label)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: queues.length > 1 ? 50 : 60,
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {rangeEn(est)}
            </div>
            <div style={{ display: 'flex', fontSize: 20, color: C.inkSoft }}>
              {est.provenance === 'reported'
                ? 'Reported by a visitor'
                : 'Estimate from past festivals, not live'}
            </div>
          </div>
        ))}
      </div>
    </OgFrame>
  );
}

export function RouteCard({ title, stops }: { title: string; stops: PinnedMandal[] }) {
  const total = legKm(stops).reduce((a, b) => a + b, 0);
  const shown = stops.slice(0, 6);
  return (
    <OgFrame
      footer={`${stops.length} mandals · ≈ ${kmLabel(total)} straight-line · ordered by geography`}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 24,
          fontWeight: 700,
          color: C.flame,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        Pandal-hopping route
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 32 ? 50 : 60,
          fontWeight: 700,
          color: C.maroon,
          lineHeight: 1.05,
        }}
      >
        {latin(title) || 'Your route'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
        {shown.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#fff',
              border: '2px solid #f0e4d3',
              borderRadius: 999,
              padding: '6px 18px 6px 6px',
              fontSize: 24,
              maxWidth: 520,
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: 999,
                backgroundColor: C.maroon,
                color: '#fef3c7',
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              {i + 1}
            </span>
            <span style={{ display: 'flex', fontWeight: 700 }}>{shortName(m.name)}</span>
          </div>
        ))}
        {stops.length > shown.length && (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, color: C.inkSoft }}>
            +{stops.length - shown.length} more
          </div>
        )}
      </div>
    </OgFrame>
  );
}

/** "Grant Road Cha Raja Sarvajanik Ganesh Utsav Mandal" → "Grant Road Cha Raja". */
export function shortName(name: string): string {
  const clean = latin(name)
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
  const cut = clean
    .replace(/\s+(Sarvajanik|Sarvajanik Ganeshotsav|Ganeshotsav|Ganesh Utsav)\b.*$/i, '')
    .trim();
  return cut.length >= 6 ? cut : clean;
}

export interface PageCardSpec {
  eyebrow: string;
  title: string;
  lines: string[];
}

export const PAGE_CARDS: Record<string, PageCardSpec> = {
  home: {
    eyebrow: 'Ganeshotsav 2026 · 14–25 Sept',
    title: "Where's the line?",
    lines: [
      'Queue starts, honest wait ranges and directions',
      'for famous Ganpati mandals across Mumbai',
    ],
  },
  routes: {
    eyebrow: 'Pandal hopping',
    title: 'Ready-made mandal routes',
    lines: [
      'Lalbaug–Parel · Khetwadi–Girgaon · King’s Circle',
      'or build your own and share one link',
    ],
  },
  plan: {
    eyebrow: 'Pandal hopping',
    title: 'Plan your group’s route',
    lines: ['Pick 2–8 mandals, get one link', 'with walking directions stop by stop'],
  },
  visarjan: {
    eyebrow: 'Visarjan day',
    title: 'Immersion day, sorted',
    lines: [
      'Dates · road closures · old bridges to keep moving on',
      'helplines · Lalbaugcha Raja procession route',
    ],
  },
  ponds: {
    eyebrow: 'Eco-friendly visarjan',
    title: 'Find an immersion pond',
    lines: ['Artificial ponds and immersion points', 'for household Ganpatis across Mumbai'],
  },
  trains: {
    eyebrow: 'Late-night darshan',
    title: 'Getting home late',
    lines: ['Night special locals · extended metro hours', 'railway crowd advisories'],
  },
  guide: {
    eyebrow: 'First-timer guide',
    title: 'Mukh darshan or navas line?',
    lines: ['When to go · what to carry', 'keeping elders and children safe in the crowd'],
  },
};

export function PageCard({ spec }: { spec: PageCardSpec }) {
  return (
    <OgFrame>
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          fontWeight: 700,
          color: C.flame,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {spec.eyebrow}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 78,
          fontWeight: 700,
          color: C.maroon,
          lineHeight: 1.05,
          marginTop: 6,
        }}
      >
        {spec.title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
        {spec.lines.map((l) => (
          <span key={l} style={{ display: 'flex', fontSize: 32, color: C.ink }}>
            {l}
          </span>
        ))}
      </div>
    </OgFrame>
  );
}

/* ---------- 1080×1920 story images (WhatsApp status / Instagram story) ---------- */

function StoryFrame({ children, stamp }: { children: React.ReactNode; stamp: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: C.cream,
        fontFamily: 'Mukta',
        color: C.ink,
      }}
    >
      <Garland height={24} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '90px 80px 0' }}>
        <Brand size={1.5} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginTop: 70 }}>
          {children}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: C.maroon,
          color: '#fef3c7',
          padding: '44px 80px 120px',
        }}
      >
        <span style={{ display: 'flex', fontSize: 30 }}>{stamp}</span>
        <span style={{ display: 'flex', fontSize: 52, fontWeight: 700, marginTop: 8 }}>
          {displayHost()}
        </span>
      </div>
    </div>
  );
}

export function MandalStory({ mandal, now }: { mandal: MandalData; now: Date }) {
  const queues = mandal.queues.slice(0, 2).map((q) => ({ q, est: estimateForQueue(q, now) }));
  return (
    <StoryFrame stamp={`Estimate made ${stampEn(now)}. Not live, and waits vary hugely.`}>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: C.flame }}>
        {mandal.area}
      </div>
      <div
        style={{ display: 'flex', fontSize: 112, fontWeight: 700, color: C.maroon, lineHeight: 1 }}
      >
        {shortName(mandal.name)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, marginTop: 80 }}>
        {queues.map(({ q, est }) => (
          <div
            key={q.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#fff',
              border: '3px solid #f0e4d3',
              borderRadius: 40,
              padding: '36px 44px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <Pill bg={C.band[est.band]} size={30}>
                {BAND_LABEL[est.band]}
              </Pill>
              <span style={{ fontSize: 38, color: C.inkSoft }}>{latin(q.label)}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 110, fontWeight: 700, lineHeight: 1.1 }}>
              {rangeEn(est)}
            </div>
            <div style={{ display: 'flex', fontSize: 32, color: C.inkSoft }}>
              {est.provenance === 'reported'
                ? 'Reported by a visitor'
                : 'Estimate from past festivals'}
            </div>
          </div>
        ))}
      </div>
      {mandal.nearestStation && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60, fontSize: 38 }}>
          <span style={{ color: C.inkSoft }}>Nearest station</span>
          <span style={{ fontWeight: 700 }}>{mandal.nearestStation}</span>
        </div>
      )}
    </StoryFrame>
  );
}

export function RouteStory({ title, stops }: { title: string; stops: PinnedMandal[] }) {
  const legs = legKm(stops);
  const total = legs.reduce((a, b) => a + b, 0);
  return (
    <StoryFrame
      stamp={`${stops.length} mandals · ≈ ${kmLabel(total)} straight-line. Real walks are longer.`}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 40,
          fontWeight: 700,
          color: C.flame,
          textTransform: 'uppercase',
          letterSpacing: 3,
        }}
      >
        Pandal-hopping route
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 96,
          fontWeight: 700,
          color: C.maroon,
          lineHeight: 1.02,
        }}
      >
        {latin(title) || 'Our route'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 70 }}>
        {stops.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 84,
                  height: 84,
                  borderRadius: 999,
                  backgroundColor: C.maroon,
                  color: '#fef3c7',
                  fontSize: 44,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    display: 'flex',
                    fontSize: stops.length > 6 ? 44 : 52,
                    fontWeight: 700,
                    lineHeight: 1.05,
                  }}
                >
                  {shortName(m.name)}
                </span>
                <span style={{ display: 'flex', fontSize: 32, color: C.inkSoft }}>{m.area}</span>
              </div>
            </div>
            {i < legs.length && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: stops.length > 6 ? 44 : 64,
                  marginLeft: 40,
                  gap: 36,
                }}
              >
                <div
                  style={{ display: 'flex', width: 4, height: '100%', backgroundColor: C.marigold }}
                />
                <span style={{ display: 'flex', fontSize: 28, color: C.inkSoft }}>
                  ≈ {kmLabel(legs[i])}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </StoryFrame>
  );
}
