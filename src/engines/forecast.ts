/**
 * CCP 2: blood demand predictive analysis, prototype implementation.
 *
 * This is not a trained forecasting model. Nothing here is fitted, learned,
 * validated, or evaluated, and no accuracy, error metric, or confidence level
 * is produced or displayed.
 *
 * What it does: composes a deterministic signal from a baseline, a slow trend,
 * a fixed weekly pattern, the illustrative scenario factors, and seeded jitter,
 * across a 90-day history window and a 14-day forward window. Two threshold
 * rules then derive the high-demand and shortage-risk signals.
 *
 * The band around the forward series is an illustrative range for legibility.
 * It is not a fitted prediction interval and is never labelled as one.
 */

import type { BloodGroup, DemandPoint, DemandSeries, ForecastPoint } from '../types';
import {
  DEMO_TODAY, FORECAST_DAYS, FORECAST_GROUPS, HISTORY_DAYS,
  dateForDayIndex, demandParameters, scenarioMultiplier,
} from '../mock/demand';
import { dailyCollectionRate, findInventory } from '../mock/banks';
import { BLOODGRID_SEED, mulberry32, roundTo } from '../mock/seed';
import { formatShortDate, toIsoDate } from '../lib/format';

/** Peak demand above this share of the trailing mean counts as elevated. */
const ELEVATED_DEMAND_RATIO = 1.18;
/** Projected demand above this share of projected cover counts as a shortage risk. */
const SHORTAGE_MARGIN = 0.98;
/** Half-width of the illustrative range at the start of the forward window. */
const BAND_START = 0.11;
/** How much the illustrative range widens per day of horizon. */
const BAND_WIDENING = 0.006;
/** Days either side of the peak highlighted as the elevated window. */
const ELEVATED_WINDOW_RADIUS = 3;

function demandOnDay(group: BloodGroup, dayIndex: number, jitter: number): number {
  const parameters = demandParameters[group];
  const dayOfWeek = dateForDayIndex(dayIndex).getUTCDay();
  const value =
    (parameters.base + parameters.trend * dayIndex) *
    parameters.weekly[dayOfWeek] *
    scenarioMultiplier(dayIndex, group) *
    (1 + (jitter * 2 - 1) * parameters.jitter);
  return Math.max(0, roundTo(value, 1));
}

function buildSeries(group: BloodGroup): DemandSeries {
  // A per-group seed keeps each series independent yet fully reproducible.
  const groupOffset = group.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const random = mulberry32(BLOODGRID_SEED + groupOffset);

  const history: DemandPoint[] = [];
  for (let index = 0; index < HISTORY_DAYS; index += 1) {
    const date = dateForDayIndex(index);
    history.push({
      date: toIsoDate(date),
      label: formatShortDate(date),
      units: demandOnDay(group, index, random()),
    });
  }

  const forecast: ForecastPoint[] = [];
  for (let offset = 0; offset < FORECAST_DAYS; offset += 1) {
    const index = HISTORY_DAYS + offset;
    const date = dateForDayIndex(index);
    const projected = demandOnDay(group, index, random());
    const halfWidth = projected * (BAND_START + BAND_WIDENING * offset);
    forecast.push({
      date: toIsoDate(date),
      label: formatShortDate(date),
      projected,
      bandLow: roundTo(Math.max(0, projected - halfWidth), 1),
      bandHigh: roundTo(projected + halfWidth, 1),
    });
  }

  const trailing = history.slice(-30);
  const trailingMean = roundTo(
    trailing.reduce((total, point) => total + point.units, 0) / trailing.length, 1,
  );

  const peak = forecast.reduce((best, point) => (point.projected > best.projected ? point : best));
  const projectedTotal = Math.round(forecast.reduce((total, point) => total + point.projected, 0));

  const currentUnits = findInventory(group)?.units ?? 0;
  const expectedCollection = Math.round(dailyCollectionRate(group) * FORECAST_DAYS);
  const projectedSupply = currentUnits + expectedCollection;

  return {
    bloodGroup: group,
    history,
    forecast,
    trailingMean,
    peakProjected: peak.projected,
    peakLabel: peak.label,
    highDemand: peak.projected >= trailingMean * ELEVATED_DEMAND_RATIO,
    shortageRisk: projectedTotal > projectedSupply * SHORTAGE_MARGIN,
    projectedTotal,
    currentUnits,
    expectedCollection,
    projectedSupply,
    projectedGap: Math.max(0, projectedTotal - projectedSupply),
  };
}

/** Built once at module load, so every screen reads identical figures. */
const seriesByGroup: Record<string, DemandSeries> = Object.fromEntries(
  FORECAST_GROUPS.map((group) => [group, buildSeries(group)]),
);

export function getDemandSeries(group: BloodGroup): DemandSeries {
  return seriesByGroup[group] ?? seriesByGroup['O+'];
}

export const TODAY_LABEL = formatShortDate(DEMO_TODAY);

export interface DemandChartRow {
  label: string;
  recorded: number | null;
  projected: number | null;
  band: [number, number] | null;
}

/** History and forecast on one continuous axis, joined at the boundary. */
export function buildChartRows(series: DemandSeries): DemandChartRow[] {
  const rows: DemandChartRow[] = series.history.map((point) => ({
    label: point.label, recorded: point.units, projected: null, band: null,
  }));

  // Repeat the last recorded value on the forecast series so the lines meet.
  const lastRecorded = series.history[series.history.length - 1];
  rows[rows.length - 1] = {
    ...rows[rows.length - 1],
    projected: lastRecorded.units,
    band: [lastRecorded.units, lastRecorded.units],
  };

  for (const point of series.forecast) {
    rows.push({
      label: point.label, recorded: null,
      projected: point.projected, band: [point.bandLow, point.bandHigh],
    });
  }
  return rows;
}

/** The stretch of the forward window highlighted as elevated, if any. */
export function elevatedWindow(series: DemandSeries): { from: string; to: string } | null {
  if (!series.highDemand) return null;
  const peakIndex = series.forecast.findIndex((point) => point.projected === series.peakProjected);
  const from = series.forecast[Math.max(0, peakIndex - ELEVATED_WINDOW_RADIUS)];
  const to = series.forecast[Math.min(series.forecast.length - 1, peakIndex + ELEVATED_WINDOW_RADIUS)];
  return { from: from.label, to: to.label };
}

export type PlanningPriority = 'high' | 'medium';

export interface PlanningItem {
  id: string;
  bloodGroup: BloodGroup;
  priority: PlanningPriority;
  /** One line of context, so the planning screen need not repeat the analytics. */
  context: string;
  recommendedAction: string;
  reason: string;
}

/**
 * Turn the simulated signals into planning prompts using explainable threshold
 * rules. These support an administrator's decision; nothing acts on its own.
 */
export function buildPlanningItems(): PlanningItem[] {
  const items: PlanningItem[] = [];

  for (const group of FORECAST_GROUPS) {
    const series = getDemandSeries(group);
    if (!series.highDemand && !series.shortageRisk) continue;

    const highPriority = series.shortageRisk;
    items.push({
      id: `PLAN-${group}`,
      bloodGroup: group,
      priority: highPriority ? 'high' : 'medium',
      context: highPriority
        ? `${group} demand is projected to stay elevated over the next ${FORECAST_DAYS} days, against ${series.projectedSupply} units of expected cover.`
        : `${group} demand is projected to rise over the next ${FORECAST_DAYS} days, peaking around ${series.peakLabel}.`,
      recommendedAction: highPriority ? 'Begin donor outreach' : 'Monitor and prepare outreach',
      reason: highPriority
        ? `Projected demand of ${series.projectedTotal} units exceeds available cover by about ${series.projectedGap} units.`
        : `Projected peak of ${series.peakProjected} units per day is above the 30-day average of ${series.trailingMean}, though current cover is sufficient.`,
    });
  }

  return items.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1));
}
