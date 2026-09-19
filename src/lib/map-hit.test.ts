import { describe, expect, it } from 'vitest';
import { nearestTo, type ScreenPoint } from './map-hit';

const at = (p: ScreenPoint) => p;

describe('nearestTo', () => {
  it('returns null when the tap hit nothing', () => {
    expect(nearestTo({ x: 10, y: 10 }, [], at)).toBeNull();
  });

  it('picks the candidate closest to the tap, not the first one', () => {
    const far = { x: 100, y: 100 };
    const near = { x: 12, y: 9 };
    expect(nearestTo({ x: 10, y: 10 }, [far, near], at)).toBe(near);
  });

  /**
   * The case this exists for: a 44 px target in a dense lane returns several
   * mandals, and tapping nearer the right-hand one must select that one.
   */
  it('separates two pins inside one finger-width', () => {
    const left = { x: 200, y: 300 };
    const right = { x: 218, y: 300 };
    const pins = [left, right];
    expect(nearestTo({ x: 203, y: 301 }, pins, at)).toBe(left);
    expect(nearestTo({ x: 215, y: 299 }, pins, at)).toBe(right);
  });

  it('keeps render order on an exact tie', () => {
    const first = { x: 0, y: 10 };
    const second = { x: 20, y: 10 };
    expect(nearestTo({ x: 10, y: 10 }, [first, second], at)).toBe(first);
  });
});
