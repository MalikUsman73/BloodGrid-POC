import { describe, expect, it } from 'vitest';
import { contactSetSize } from '../src/engine';

describe('contact set size', () => {
  it.each([
    ['Routine', 1, 2], ['Routine', 2, 3], ['Routine', 3, 4],
    ['Urgent', 1, 2], ['Urgent', 2, 4], ['Urgent', 3, 5],
    ['Critical', 1, 2], ['Critical', 2, 4], ['Critical', 3, 6],
  ] as const)('%s with %i units notifies %i donors', (urgency, units, k) => {
    expect(contactSetSize(units, urgency)).toBe(k);
  });

  it('is not thrown off by float noise (1.6 x 5 is exactly 8)', () => {
    expect(contactSetSize(5, 'Urgent')).toBe(8);
  });

  it('rejects zero, negative and fractional units', () => {
    expect(() => contactSetSize(0, 'Routine')).toThrow(RangeError);
    expect(() => contactSetSize(-1, 'Routine')).toThrow(RangeError);
    expect(() => contactSetSize(1.5, 'Routine')).toThrow(RangeError);
  });
});
