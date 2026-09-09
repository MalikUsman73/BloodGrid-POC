import { donors } from '../../mock/donors';

/**
 * The donor persona used by the Tier 2 donor experience.
 * DNR-001 is the top-ranked donor for the demonstration O+ request, so a
 * request sent from the seeker workspace lands here and closes the loop.
 */
export const DEMO_DONOR = donors.find((d) => d.id === 'DNR-001')!;
