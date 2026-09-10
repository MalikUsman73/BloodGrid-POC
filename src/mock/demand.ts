/**
 * Base parameters for the simulated demand series.
 *
 * These numbers are invented for the demonstration. They are not derived from,
 * and do not represent, any real blood bank's records.
 *
 * The scenario factors below (seasonal illness, holiday travel) are illustrative
 * simulated inputs used to make the demonstration chart legible. They are not
 * real causal findings, and no such relationship has been measured or validated
 * in this project.
 */

import type { BloodGroup, ScenarioFactor } from '../types';
import { formatShortDate, toIsoDate } from '../lib/format';

/** Fixed anchor date, so every run produces identical dates and labels. */
export const DEMO_TODAY = new Date(Date.UTC(2026, 8, 10));

export const HISTORY_DAYS = 90;
export const FORECAST_DAYS = 14;

export interface DemandParameters {
  base: number;
  /** Units per day of slow drift across the history window. */
  trend: number;
  /** Seven-day pattern starting Sunday, applied multiplicatively. */
  weekly: number[];
  jitter: number;
}

export const FORECAST_GROUPS: BloodGroup[] = ['O+', 'A+', 'B+', 'AB+'];

export const demandParameters: Record<string, DemandParameters> = {
  'O+':  { base: 14.0, trend: 0.030, weekly: [0.92, 0.96, 1.00, 1.02, 1.05, 1.14, 1.09], jitter: 0.06 },
  'A+':  { base: 9.4,  trend: 0.012, weekly: [0.94, 0.98, 1.01, 1.03, 1.04, 1.08, 1.03], jitter: 0.06 },
  'B+':  { base: 8.0,  trend: 0.008, weekly: [0.95, 0.99, 1.00, 1.02, 1.03, 1.07, 1.04], jitter: 0.05 },
  'AB+': { base: 3.1,  trend: 0.004, weekly: [0.96, 1.00, 1.00, 1.01, 1.02, 1.05, 1.02], jitter: 0.05 },
};

/**
 * Illustrative simulated scenario factors. Day indices run 0 to 89 across the
 * history window and 90 to 103 across the forecast window.
 */
export const scenarioFactors: ScenarioFactor[] = [
  {
    id: 'SF-1',
    label: 'Simulated seasonal illness period',
    description: 'Illustrative factor used to shape the demonstration data. Not a measured effect.',
    startIndex: 38, endIndex: 60, scope: 'history',
  },
  {
    id: 'SF-2',
    label: 'Simulated holiday travel period',
    description: 'Illustrative factor representing a short elevated-trauma window.',
    startIndex: 70, endIndex: 75, scope: 'history',
  },
  {
    id: 'SF-3',
    label: 'Simulated seasonal illness resurgence',
    description: 'Illustrative factor applied to the forecast window, not a model prediction.',
    startIndex: 93, endIndex: 103, scope: 'forecast',
  },
];

/** How strongly each group reacts to the scenario factors in this dataset. */
const GROUP_SENSITIVITY: Record<string, number> = {
  'O+': 1.0, 'A+': 0.55, 'B+': 0.42, 'AB+': 0.3,
};

const FACTOR_PEAK: Record<string, number> = { 'SF-1': 0.22, 'SF-2': 0.20, 'SF-3': 0.30 };

export function scenarioMultiplier(dayIndex: number, group: BloodGroup): number {
  const sensitivity = GROUP_SENSITIVITY[group] ?? 0.3;
  let multiplier = 1;
  for (const factor of scenarioFactors) {
    if (dayIndex < factor.startIndex || dayIndex > factor.endIndex) continue;
    const span = factor.endIndex - factor.startIndex;
    const progress = span === 0 ? 1 : (dayIndex - factor.startIndex) / span;
    // A rise-and-hold curve, so the bump reads as a period rather than a spike.
    const shape = Math.sin(Math.PI * Math.min(progress * 1.35, 1));
    multiplier += shape * (FACTOR_PEAK[factor.id] ?? 0.2) * sensitivity;
  }
  return multiplier;
}

export function dateForDayIndex(dayIndex: number): Date {
  const date = new Date(DEMO_TODAY);
  date.setUTCDate(date.getUTCDate() - (HISTORY_DAYS - 1) + dayIndex);
  return date;
}

export { formatShortDate, toIsoDate };
