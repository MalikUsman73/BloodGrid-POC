import { isCompatible } from './compatibility';
import type { Donor, MatchConfig, MatchRequest } from './types';

export type FilterId = 'compatibility' | 'availability' | 'interval' | 'radius' | 'contactCap';

export interface FilterStage {
  id: FilterId;
  label: string;
  rule: string;
  /** Donors entering this stage. */
  before: number;
  /** Donors removed by this stage. */
  removed: number;
  remaining: number;
}

export interface Rejection {
  donorId: string;
  stage: FilterId;
}

export interface ScreeningResult {
  eligible: Donor[];
  stages: FilterStage[];
  rejections: Rejection[];
}

interface Rule {
  id: FilterId;
  label: string;
  rule: (config: MatchConfig) => string;
  passes: (donor: Donor, request: MatchRequest, config: MatchConfig) => boolean;
}

/** Applied in this order. A donor is attributed to the first rule that removes them. */
const RULES: Rule[] = [
  {
    id: 'compatibility',
    label: 'Blood group compatible',
    rule: () => 'Donor group can be given to the recipient group (ABO and Rh)',
    passes: (d, r) => isCompatible(r.recipientGroup, d.group),
  },
  {
    id: 'availability',
    label: 'Available and not on hold',
    rule: () => 'Marked available and not committed to another open request',
    passes: (d) => d.available && d.heldBy === null,
  },
  {
    id: 'interval',
    label: 'Donation interval met',
    rule: (c) => `At least ${c.cooldownDays} days since the last donation`,
    passes: (d, _r, c) => d.daysSinceDonation >= c.cooldownDays,
  },
  {
    id: 'radius',
    label: 'Inside service radius',
    rule: (c) => `Within ${c.radiusKm} km of the request sector`,
    passes: (d, _r, c) => d.distanceKm <= c.radiusKm,
  },
  {
    id: 'contactCap',
    label: 'Below contact cap',
    rule: (c) => `Fewer than ${c.contactCap} contacts in the last 30 days`,
    passes: (d, _r, c) => d.contactsLast30d < c.contactCap,
  },
];

export function screenDonors(pool: readonly Donor[], request: MatchRequest, config: MatchConfig): ScreeningResult {
  let current = pool.slice();
  const stages: FilterStage[] = [];
  const rejections: Rejection[] = [];
  for (const rule of RULES) {
    const before = current.length;
    const kept: Donor[] = [];
    for (const donor of current) {
      if (rule.passes(donor, request, config)) kept.push(donor);
      else rejections.push({ donorId: donor.id, stage: rule.id });
    }
    stages.push({
      id: rule.id,
      label: rule.label,
      rule: rule.rule(config),
      before,
      removed: before - kept.length,
      remaining: kept.length,
    });
    current = kept;
  }
  return { eligible: current, stages, rejections };
}
