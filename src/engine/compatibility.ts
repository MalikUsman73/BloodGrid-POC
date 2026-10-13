import type { BloodGroup } from './types';

/** Recipient group to the donor groups whose red cells it can receive. */
export const COMPATIBLE_DONOR_GROUPS: Record<BloodGroup, readonly BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export function isCompatible(recipient: BloodGroup, donor: BloodGroup): boolean {
  return COMPATIBLE_DONOR_GROUPS[recipient].includes(donor);
}

/** Versatility V(g): how many recipient groups a donor group can serve. */
export function versatility(donor: BloodGroup): number {
  let n = 0;
  for (const recipient of Object.keys(COMPATIBLE_DONOR_GROUPS) as BloodGroup[]) {
    if (isCompatible(recipient, donor)) n += 1;
  }
  return n;
}
