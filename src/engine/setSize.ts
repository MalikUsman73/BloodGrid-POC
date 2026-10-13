import type { Urgency } from './types';

/** Over-notification factor: some donors decline, and critical requests cannot wait for a second round. */
export const NOTIFY_FACTOR: Record<Urgency, number> = {
  Routine: 1.3,
  Urgent: 1.6,
  Critical: 2.0,
};

/** k = ceil(factor x units). Rounding first avoids float noise such as 1.6 x 5 = 8.000000000000002. */
export function contactSetSize(units: number, urgency: Urgency): number {
  if (!Number.isInteger(units) || units < 1) {
    throw new RangeError('units must be a positive integer');
  }
  return Math.ceil(Math.round(NOTIFY_FACTOR[urgency] * units * 1e6) / 1e6);
}
