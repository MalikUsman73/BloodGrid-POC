/**
 * Seeded demonstration blood requests.
 *
 * PROTOTYPE / MOCK DATA — DEMONSTRATION ONLY.
 * Patients are referenced by case number only. No patient names, records, or
 * identifying details exist anywhere in this prototype.
 */

import type { BloodRequest } from '../types';

export const seededRequests: BloodRequest[] = [
  {
    id: 'REQ-2291',
    bloodGroup: 'B+', urgency: 'Routine', sector: 'G-8', units: 1,
    patientRef: 'Case #2291', hospital: 'Central Regional Hospital',
    createdAt: '2026-08-24', createdLabel: '24 Aug 2026',
    status: 'Fulfilled', contactedDonorIds: ['DNR-013'],
  },
  {
    id: 'REQ-2384',
    bloodGroup: 'A+', urgency: 'Urgent', sector: 'G-8', units: 2,
    patientRef: 'Case #2384', hospital: 'Central Regional Hospital',
    createdAt: '2026-09-06', createdLabel: '6 Sep 2026',
    status: 'Donors Contacted', contactedDonorIds: ['DNR-012'],
  },
];

/** Prefilled values for the demonstration request, matching the defense script. */
export const DEMO_REQUEST_DEFAULTS = {
  bloodGroup: 'O+' as const,
  urgency: 'Urgent' as const,
  sector: 'G-8',
  units: 2,
  hospital: 'Central Regional Hospital',
};
