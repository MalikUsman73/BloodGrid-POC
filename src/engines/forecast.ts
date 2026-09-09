/**
 * ============================================================================
 * CCP 2 — BLOOD DEMAND PREDICTIVE ANALYSIS
 *          ::  PROTOTYPE / SIMULATED FORECAST GENERATOR
 * ============================================================================
 *
 * THIS IS NOT A TRAINED FORECASTING MODEL. NOTHING IN THIS FILE IS FITTED,
 * LEARNED, VALIDATED, OR EVALUATED. NO ACCURACY, ERROR METRIC, OR CONFIDENCE
 * LEVEL IS PRODUCED, AND NONE MAY BE DISPLAYED.
 *
 * What this file does:
 *   Composes a deterministic signal — baseline + trend + fixed weekly pattern
 *   + illustrative scenario factors + seeded jitter — across a 90-day history
 *   window and a 14-day forward window, then applies simple threshold rules to
 *   derive a high-demand signal and a shortage-risk signal.
 *
 * The "band" around the forward series is an ILLUSTRATIVE RANGE for visual
 * legibility. It is NOT a fitted statistical prediction interval and must never
 * be labelled as one.
 *
 * Output must always be presented in the UI as:
 *   "Prototype Forecast — Simulated for Proposal-Stage Demonstration"
 *   "Future Implementation: Trained Forecasting Model"
 * ============================================================================
 */

import type { BloodGroup, DemandPoint, DemandSeries, ForecastPoint } from '../types';
import {
  FORECAST_DAYS, HISTORY_DAYS, dayFromIndex, demandParams, isoOf, labelOf,
  scenarioFactors, scenarioMultiplier,
} from '../mock/demand';
import { dailyCollection, getInventory } from '../mock/banks';
import { mulberry32, round } from '../mock/seed';

/** Threshold at which the forward window is flagged as an elevated-demand period. */
const HIGH_DEMAND_RATIO = 1.18;
/**
 * Shortage rule: projected consumption over the forward window is compared with
 * held stock PLUS routine collection expected over the same window. A margin
 * keeps small, recoverable deficits from raising an alert.
 */
const SHORTAGE_MARGIN = 0.98;
/** Half-width of the illustrative range at the start of the forward window. */
const BAND_BASE = 0.11;

function unitsAt(group: BloodGroup, dayIndex: number, jitter: number): number {
  const p = demandParams[group];
  const dow = dayFromIndex(dayIndex).getUTCDay();
  const value =
    (p.base + p.trend * dayIndex) *
    p.weekly[dow] *
    scenarioMultiplier(dayIndex, group) *
    (1 + (jitter * 2 - 1) * p.amplitude);
  return Math.max(0, round(value, 1));
}

function buildSeries(group: BloodGroup): DemandSeries {
  // A per-group seed keeps each series independent yet perfectly reproducible.
  const seedOffset = group.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = mulberry32(20260910 + seedOffset);

  const history: DemandPoint[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = dayFromIndex(i);
    history.push({ date: isoOf(d), label: labelOf(d), units: unitsAt(group, i, rng()) });
  }

  const forecast: ForecastPoint[] = [];
  for (let k = 0; k < FORECAST_DAYS; k++) {
    const i = HISTORY_DAYS + k;
    const d = dayFromIndex(i);
    const projected = unitsAt(group, i, rng());
    // The illustrative range widens with horizon purely for visual legibility.
    const halfWidth = projected * (BAND_BASE + 0.006 * k);
    forecast.push({
      date: isoOf(d),
      label: labelOf(d),
      projected,
      bandLow: round(Math.max(0, projected - halfWidth), 1),
      bandHigh: round(projected + halfWidth, 1),
    });
  }

  const trailing = history.slice(-30);
  const trailingMean = round(trailing.reduce((a, p) => a + p.units, 0) / trailing.length, 1);

  let peak = forecast[0];
  for (const f of forecast) if (f.projected > peak.projected) peak = f;

  const projectedTotal = round(forecast.reduce((a, f) => a + f.projected, 0), 0);
  const inv = getInventory(group);
  const currentUnits = inv ? inv.units : 0;

  const expectedCollection = round(dailyCollection(group) * FORECAST_DAYS, 0);
  const projectedSupply = currentUnits + expectedCollection;

  const highDemand = peak.projected >= trailingMean * HIGH_DEMAND_RATIO;
  const shortageRisk = projectedTotal > projectedSupply * SHORTAGE_MARGIN;
  const projectedGap = Math.max(0, Math.round(projectedTotal - projectedSupply));

  return {
    bloodGroup: group,
    history,
    forecast,
    factors: scenarioFactors,
    trailingMean,
    peakProjected: peak.projected,
    peakLabel: peak.label,
    highDemand,
    shortageRisk,
    projectedTotal,
    currentUnits,
    projectedGap,
    expectedCollection,
    projectedSupply,
  };
}

/** Precomputed at module load — identical on every run. */
export const demandSeries: Record<string, DemandSeries> = {
  'O+': buildSeries('O+'),
  'A+': buildSeries('A+'),
  'B+': buildSeries('B+'),
  'AB+': buildSeries('AB+'),
};

export function getSeries(group: BloodGroup): DemandSeries {
  return demandSeries[group] ?? demandSeries['O+'];
}

/** Combined chart rows: history then forward window, on one continuous axis. */
export function chartRows(s: DemandSeries) {
  const rows: any[] = s.history.map((h) => ({
    label: h.label, date: h.date, actual: h.units,
    projected: null, band: null,
  }));
  // Join the two lines at the boundary so the chart shows no visual gap.
  const last = s.history[s.history.length - 1];
  rows[rows.length - 1] = {
    ...rows[rows.length - 1],
    projected: last.units, band: [last.units, last.units],
  };
  for (const f of s.forecast) {
    rows.push({
      label: f.label, date: f.date, actual: null,
      projected: f.projected,
      // Range area: [lower, upper]. Recharts fills only between the two,
      // rather than down to the axis.
      band: [f.bandLow, f.bandHigh],
    });
  }
  return rows;
}

export interface PlanningInsight {
  id: string;
  severity: 'critical' | 'elevated' | 'stable';
  headline: string;
  detail: string;
  bloodGroup: BloodGroup;
}

/**
 * Derive planning insights from the simulated signals using simple, explainable
 * threshold rules. These are workflow prompts for a human administrator, never
 * autonomous decisions.
 */
export function planningInsights(): PlanningInsight[] {
  const out: PlanningInsight[] = [];
  for (const g of ['O+', 'A+', 'B+', 'AB+'] as BloodGroup[]) {
    const s = getSeries(g);
    if (s.shortageRisk && s.highDemand) {
      out.push({
        id: `PI-${g}`, severity: 'critical', bloodGroup: g,
        headline: `Projected ${g} shortfall in the prototype forecast window`,
        detail: `Simulated demand across the next ${FORECAST_DAYS} days totals ${s.projectedTotal} units. Held stock of ${s.currentUnits} units plus ${s.expectedCollection} units of routine collection gives ${s.projectedSupply} units of cover — an indicative shortfall of ${s.projectedGap} units, with demand peaking around ${s.peakLabel}.`,
      });
    } else if (s.highDemand) {
      out.push({
        id: `PI-${g}`, severity: 'elevated', bloodGroup: g,
        headline: `Expected ${g} demand increase in the next forecast period`,
        detail: `Simulated peak of ${s.peakProjected} units/day around ${s.peakLabel}, against a 30-day trailing average of ${s.trailingMean} units/day.`,
      });
    } else if (s.shortageRisk) {
      out.push({
        id: `PI-${g}`, severity: 'critical', bloodGroup: g,
        headline: `${g} stock cover below projected consumption`,
        detail: `Simulated consumption of ${s.projectedTotal} units over the forward window against ${s.projectedSupply} units of projected cover.`,
      });
    }
  }
  const order = { critical: 0, elevated: 1, stable: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
