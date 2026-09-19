/**
 * Marigold and rose petals drifting down. Deterministic (index-seeded), so
 * the server render and the client agree, and pure CSS, so no JS runs per
 * frame. Hidden entirely under prefers-reduced-motion.
 */
const COLORS = ['#f59e0b', '#fb923c', '#fde047', '#f97316', '#e11d48', '#fbbf24', '#be123c'];

/**
 * Integer hash → [0, 1). Integer maths only: Math.sin differs in its last
 * bits between the server's V8 and the browser, which broke hydration.
 */
function seeded(i: number, salt: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 10_000) / 10_000;
}

export default function Petals({ count = 36, slow = false }: { count?: number; slow?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const size = 9 + seeded(i, 1) * 11;
        const dur = (slow ? 14 : 7) + seeded(i, 2) * (slow ? 10 : 6);
        return (
          <span
            key={i}
            className="ashirwad-petal"
            style={
              {
                left: `${seeded(i, 3) * 100}%`,
                width: `${size}px`,
                height: `${size * 0.72}px`,
                background: COLORS[i % COLORS.length],
                boxShadow: 'inset -2px -2px 4px rgb(0 0 0 / 0.18)',
                '--dur': `${dur.toFixed(2)}s`,
                // Negative delays: the shower is already falling when the page opens.
                '--delay': `${(-seeded(i, 4) * dur).toFixed(2)}s`,
                '--drift': `${Math.round((seeded(i, 5) - 0.5) * 160)}px`,
                '--spin': `${Math.round(360 + seeded(i, 6) * 540)}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
