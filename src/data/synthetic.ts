import type { BloodGroup } from '../engine';
import { SECTORS } from './sectors';

/** Row shape shared by the database seed and the offline fallback. */
export interface DonorRow {
  code: string;
  group: BloodGroup;
  sector: string;
  daysSinceDonation: number;
  available: boolean;
  accepted: number;
  received: number;
  contactsLast30d: number;
}

export const SEED = 20261016;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rough group shares for a South Asian population. Synthetic, not a statistic. */
const GROUP_SHARES: [BloodGroup, number][] = [
  ['O+', 0.31], ['B+', 0.3], ['A+', 0.22], ['AB+', 0.07],
  ['O-', 0.03], ['B-', 0.03], ['A-', 0.03], ['AB-', 0.01],
];

function pickGroup(r: number): BloodGroup {
  let acc = 0;
  for (const [g, share] of GROUP_SHARES) {
    acc += share;
    if (r < acc) return g;
  }
  return 'O+';
}

/**
 * Generate the synthetic donor pool. Each donor has a latent reliability. Reliable donors are
 * asked more and donate more, so they are on average less recovered: the structural conflict
 * between O2 and O3 described in the solution document is built into the data.
 */
export function generateDonors(count = 300, seed = SEED): DonorRow[] {
  const r = mulberry32(seed);
  const rows: DonorRow[] = [];
  for (let i = 1; i <= count; i += 1) {
    const reliability = 0.15 + 0.8 * r();
    const received = Math.floor(r() * 13);
    let accepted = 0;
    for (let j = 0; j < received; j += 1) if (r() < reliability) accepted += 1;
    // Reliable donors donate more often, so the gap since the last donation is shorter.
    const recentBias = reliability > 0.6 ? 0.55 : 0.3;
    const days = r() < recentBias ? 12 + Math.floor(r() * 78) : 90 + Math.floor(r() * 330);
    rows.push({
      code: `D-${String(i).padStart(4, '0')}`,
      group: pickGroup(r()),
      sector: SECTORS[Math.floor(r() * SECTORS.length)].id,
      daysSinceDonation: days,
      available: r() < 0.82,
      accepted,
      received,
      contactsLast30d: r() < 0.7 ? 0 : 1 + Math.floor(r() * 3),
    });
  }
  return rows;
}
