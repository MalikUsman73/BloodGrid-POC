import { describe, expect, it } from 'vitest';
import { BLOOD_GROUPS, COMPATIBLE_DONOR_GROUPS, isCompatible, versatility } from '../src/engine';

describe('blood group compatibility', () => {
  it('lets O negative give to every recipient group', () => {
    for (const recipient of BLOOD_GROUPS) expect(isCompatible(recipient, 'O-')).toBe(true);
  });

  it('lets AB positive receive from every donor group', () => {
    for (const donor of BLOOD_GROUPS) expect(isCompatible('AB+', donor)).toBe(true);
  });

  it('only lets AB positive give to AB positive', () => {
    const recipients = BLOOD_GROUPS.filter((r) => isCompatible(r, 'AB+'));
    expect(recipients).toEqual(['AB+']);
  });

  it('never gives Rh positive blood to an Rh negative recipient', () => {
    for (const recipient of BLOOD_GROUPS.filter((g) => g.endsWith('-'))) {
      for (const donor of BLOOD_GROUPS.filter((g) => g.endsWith('+'))) {
        expect(isCompatible(recipient, donor)).toBe(false);
      }
    }
  });

  it('matches the reference table for A negative recipients', () => {
    expect([...COMPATIBLE_DONOR_GROUPS['A-']]).toEqual(['O-', 'A-']);
    expect(isCompatible('A-', 'B-')).toBe(false);
  });

  it('computes versatility as the number of recipient groups served', () => {
    expect(Object.fromEntries(BLOOD_GROUPS.map((g) => [g, versatility(g)]))).toEqual({
      'O-': 8, 'O+': 4, 'A-': 4, 'A+': 2, 'B-': 4, 'B+': 2, 'AB-': 2, 'AB+': 1,
    });
  });
});
