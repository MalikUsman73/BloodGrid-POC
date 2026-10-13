import type { BloodGroup, Donor, MatchRequest } from '../src/engine';

let counter = 0;

/** Build a donor that passes every default rule, then override what a test cares about. */
export function donor(overrides: Partial<Donor> = {}): Donor {
  counter += 1;
  const id = overrides.id ?? `d${String(counter).padStart(3, '0')}`;
  return {
    id,
    code: `D-${id}`,
    group: 'O+',
    sector: 'G-9',
    distanceKm: 4,
    daysSinceDonation: 150,
    available: true,
    heldBy: null,
    contactsLast30d: 0,
    accepted: 4,
    received: 8,
    ...overrides,
  };
}

export function request(overrides: Partial<MatchRequest> = {}): MatchRequest {
  return { recipientGroup: 'O+' as BloodGroup, units: 1, urgency: 'Routine', sector: 'G-8', ...overrides };
}

/** Small seeded generator so property tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
