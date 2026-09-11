/**
 * Status vocabulary for the whole application.
 *
 * Colour carries meaning here and nowhere else: a tone is only ever chosen
 * because of what the value means, never for decoration.
 */

import type { MatchTier, RequestStatus, StockStatus, Urgency } from '../types';

/** Semantic tones. `neutral` is the default and covers most of the interface. */
export type Tone = 'neutral' | 'info' | 'good' | 'attention' | 'urgent';

export function requestStatusTone(status: RequestStatus): Tone {
  switch (status) {
    case 'Fulfilled': return 'good';
    case 'Donor Accepted': return 'good';
    case 'Awaiting Response': return 'info';
    default: return 'neutral';
  }
}

export function urgencyTone(urgency: Urgency): Tone {
  return urgency === 'Critical' ? 'urgent' : urgency === 'Urgent' ? 'attention' : 'neutral';
}

export function tierTone(tier: MatchTier): Tone {
  return tier === 'Excellent' ? 'good' : tier === 'Good' ? 'info' : 'neutral';
}

export function availabilityTone(available: boolean): Tone {
  return available ? 'good' : 'neutral';
}

export function availabilityLabel(available: boolean): string {
  return available ? 'Available' : 'Not available';
}

export function stockTone(status: StockStatus): Tone {
  switch (status) {
    case 'Healthy': return 'good';
    case 'Watch': return 'info';
    case 'Low': return 'attention';
    case 'Critical': return 'urgent';
  }
}
