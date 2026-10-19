import type { Urgency } from './types';

export const URGENCY_RANK: Record<Urgency, number> = { Routine: 0, Urgent: 1, Critical: 2 };

/**
 * Conflict rule between two requests that want the same donor. A critical request may take a donor
 * who is only being asked by a less urgent request. A donor who has already said yes is never taken.
 */
export function canPreempt(requestUrgency: Urgency, heldUrgency: Urgency | null | undefined, heldAccepted: boolean | undefined): boolean {
  if (heldAccepted || !heldUrgency) return false;
  return requestUrgency === 'Critical' && URGENCY_RANK[heldUrgency] < URGENCY_RANK.Critical;
}
