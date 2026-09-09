/**
 * Base parameters for the SIMULATED demand series (CCP 2).
 *
 * PROTOTYPE / MOCK DATA — DEMONSTRATION ONLY.
 * These numbers are invented for the proposal-stage demonstration. They are not
 * derived from, and do not represent, any real blood bank's demand records.
 *
 * The scenario factors below (seasonal illness, public holidays, etc.) are
 * ILLUSTRATIVE SIMULATED SCENARIO FACTORS used to make the demonstration chart
 * legible. They are NOT real causal findings and no such relationship has been
 * studied, measured, or validated in this project.
 */

import type { BloodGroup, ScenarioFactor } from '../types';

/** Fixed anchor date so every run produces identical dates and labels. */
export const DEMO_TODAY = new Date(Date.UTC(2026, 8, 10)); // 10 Sep 2026

export const HISTORY_DAYS = 90;
export const FORECAST_DAYS = 14;

export interface DemandParams {
  base: number;
  /** Units per day of slow drift across the history window. */
  trend: number;
  /** Seven-day pattern starting Sunday. Multiplicative. */
  weekly: number[];
  amplitude: number;
}

export const demandParams: Record<string, DemandParams> = {
  'O+':  { base: 14.0, trend: 0.030, weekly: [0.92, 0.96, 1.00, 1.02, 1.05, 1.14, 1.09], amplitude: 0.06 },
  'A+':  { base: 9.4,  trend: 0.012, weekly: [0.94, 0.98, 1.01, 1.03, 1.04, 1.08, 1.03], amplitude: 0.06 },
  'B+':  { base: 8.0,  trend: 0.008, weekly: [0.95, 0.99, 1.00, 1.02, 1.03, 1.07, 1.04], amplitude: 0.05 },
  'AB+': { base: 3.1,  trend: 0.004, weekly: [0.96, 1.00, 1.00, 1.01, 1.02, 1.05, 1.02], amplitude: 0.05 },
};

export const FORECAST_GROUPS: BloodGroup[] = ['O+', 'A+', 'B+', 'AB+'];

/**
 * Illustrative simulated scenario factors.
 * Indices are day offsets: history days are 0..89, forecast days are 90..103.
 */
export const scenarioFactors: ScenarioFactor[] = [
  {
    id: 'SF-1',
    label: 'Simulated seasonal illness period',
    description:
      'Illustrative scenario factor used to shape the demonstration data. Not a measured or validated effect.',
    startIndex: 38, endIndex: 60, scope: 'history',
  },
  {
    id: 'SF-2',
    label: 'Simulated public-holiday travel period',
    description:
      'Illustrative scenario factor representing a short elevated-trauma window. Demonstration only.',
    startIndex: 70, endIndex: 75, scope: 'history',
  },
  {
    id: 'SF-3',
    label: 'Simulated seasonal illness resurgence',
    description:
      'Illustrative scenario factor applied to the prototype forecast window. Not a prediction produced by a trained model.',
    startIndex: 93, endIndex: 103, scope: 'forecast',
  },
];

/** Multiplicative contribution of the illustrative scenario factors, per day index. */
export function scenarioMultiplier(dayIndex: number, group: BloodGroup): number {
  // Universal-donor demand reacts most strongly in this simulated dataset.
  const sensitivity = group === 'O+' ? 1.0 : group === 'A+' ? 0.55 : group === 'B+' ? 0.42 : 0.3;
  let m = 1;
  for (const f of scenarioFactors) {
    if (dayIndex < f.startIndex || dayIndex > f.endIndex) continue;
    const span = f.endIndex - f.startIndex;
    const t = span === 0 ? 1 : (dayIndex - f.startIndex) / span;
    // Smooth rise-and-hold curve so the bump reads as a period, not a spike.
    const shape = Math.sin(Math.PI * Math.min(t * 1.35, 1));
    const peak = f.id === 'SF-2' ? 0.20 : f.id === 'SF-3' ? 0.30 : 0.22;
    m += shape * peak * sensitivity;
  }
  return m;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function dayFromIndex(dayIndex: number): Date {
  const d = new Date(DEMO_TODAY);
  d.setUTCDate(d.getUTCDate() - (HISTORY_DAYS - 1) + dayIndex);
  return d;
}

export function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function labelOf(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
