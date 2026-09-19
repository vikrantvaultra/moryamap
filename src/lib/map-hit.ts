/**
 * Picking what a finger meant to tap.
 *
 * Map pins are hit-tested against transparent 44 px circles, not the 15–19 px
 * dots you can see, because a fingertip cannot reliably land inside the dot.
 * The cost of that is overlap: in a Khetwadi lane several mandals sit inside
 * one finger-width, so a tap returns several candidates and the first one
 * MapLibre hands back is whichever is topmost, not whichever is closest.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * The candidate whose screen position is closest to the tap. Returns null for
 * an empty list, so callers can treat "tapped nothing" as "close the sheet".
 * Ties keep the earlier candidate, which is MapLibre's render order.
 */
export function nearestTo<T>(
  tap: ScreenPoint,
  candidates: T[],
  positionOf: (candidate: T) => ScreenPoint,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const at = positionOf(candidate);
    // Squared distance: same ordering, no square root.
    const distance = (at.x - tap.x) ** 2 + (at.y - tap.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}
