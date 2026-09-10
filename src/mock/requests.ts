/**
 * Seeded demonstration requests, so the seeker screens are never empty on a
 * first visit. Patients appear as case references only.
 */

import type { BloodRequest } from '../types';

export const seededRequests: BloodRequest[] = [
  {
    id: 'REQ-2291',
    bloodGroup: 'B+', urgency: 'Routine', sector: 'G-8', units: 1,
    patientRef: 'Case 2291', facility: 'Central Regional Hospital',
    createdLabel: '24 Aug 2026', status: 'Fulfilled',
  },
  {
    id: 'REQ-2384',
    bloodGroup: 'A+', urgency: 'Urgent', sector: 'G-8', units: 2,
    patientRef: 'Case 2384', facility: 'Central Regional Hospital',
    createdLabel: '6 Sep 2026', status: 'Awaiting Response',
  },
];

/** Values the request form opens with, matching the defense script. */
export const REQUEST_FORM_DEFAULTS = {
  bloodGroup: 'O+' as const,
  urgency: 'Urgent' as const,
  sector: 'G-8',
  units: 2,
  facility: 'Central Regional Hospital',
};
