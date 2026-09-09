import type { Availability, MatchTier, RequestStatus } from '../../types';

export function statusTone(s: RequestStatus): 'green' | 'blue' | 'amber' {
  return s === 'Fulfilled' ? 'green' : s === 'Donors Contacted' ? 'blue' : 'amber';
}

export function tierTone(t: MatchTier): 'green' | 'blue' | 'amber' {
  return t === 'Excellent' ? 'green' : t === 'Good' ? 'blue' : 'amber';
}

export function availabilityTone(a: Availability): 'green' | 'amber' | 'slate' {
  return a === 'Available' ? 'green' : a === 'Limited' ? 'amber' : 'slate';
}

/** Tailwind text colour matching the map marker fill for each tier. */
export const TIER_TEXT: Record<MatchTier, string> = {
  Excellent: 'text-emerald-600',
  Good: 'text-sky-600',
  Moderate: 'text-amber-600',
};
