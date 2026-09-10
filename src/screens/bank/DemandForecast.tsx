/**
 * Demand and forecast, the main output of CCP 2.
 *
 * This screen is for understanding the trend. It carries the analysis: history,
 * forecast, the signals derived from them, and the simulated inputs behind the
 * shape of the data. What to do about it belongs on the planning screen, so no
 * actions are repeated here.
 *
 * Nothing on this screen comes from a trained model, and no accuracy, error
 * metric, or confidence level is computed or shown.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BloodGroup } from '../../types';
import {
  Button, Figure, FigureRow, Page, PageTitle, Section,
} from '../../components/ui';
import { Footnote, PrototypeNote, SimulatedMark } from '../../components/PrototypeLabels';
import DemandChart, { DemandChartLegend } from '../../components/charts/DemandChart';
import { getDemandSeries } from '../../engines/forecast';
import { FORECAST_DAYS, FORECAST_GROUPS, HISTORY_DAYS, scenarioFactors } from '../../mock/demand';

export default function DemandForecast() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('group') as BloodGroup | null;
  const [group, setGroup] = useState<BloodGroup>(
    requested && FORECAST_GROUPS.includes(requested) ? requested : 'O+',
  );

  const series = getDemandSeries(group);

  function selectGroup(next: BloodGroup) {
    setGroup(next);
    setSearchParams({ group: next }, { replace: true });
  }

  return (
    <Page>
      <PageTitle
        title="Demand and forecast"
        description={`${HISTORY_DAYS} days of simulated recorded demand, followed by a ${FORECAST_DAYS}-day prototype forecast.`}
        actions={<Button to="/bank/planning">Go to planning</Button>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-7">
        <span className="text-[12.5px] text-slate-500 mr-1">Blood group</span>
        {FORECAST_GROUPS.map((option) => {
          const optionSeries = getDemandSeries(option);
          const selected = option === group;
          return (
            <button
              key={option}
              type="button"
              onClick={() => selectGroup(option)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                selected
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              <span className="tabular-nums">{option}</span>
              {(optionSeries.shortageRisk || optionSeries.highDemand) && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    selected ? 'bg-white/70'
                    : optionSeries.shortageRisk ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <FigureRow>
        <Figure
          label="30-day average" value={series.trailingMean} unit="units/day"
          note="Trailing mean of recorded demand"
        />
        <Figure
          label="Peak projected" value={series.peakProjected} unit="units/day"
          tone={series.highDemand ? 'attention' : undefined}
          note={`Around ${series.peakLabel}`}
        />
        <Figure
          label={`Next ${FORECAST_DAYS} days`} value={series.projectedTotal} unit="units"
          note={`Against ${series.projectedSupply} units of cover`}
        />
        <Figure
          label="Indicative shortfall" value={series.projectedGap} unit="units"
          tone={series.shortageRisk ? 'urgent' : 'good'}
          note={series.shortageRisk ? 'Demand exceeds cover' : 'Cover exceeds demand'}
        />
      </FigureRow>

      <Section title={`${group} demand`} actions={<SimulatedMark />}>
        <DemandChart series={series} />
        <div className="mt-3">
          <DemandChartLegend />
        </div>
        <div className="mt-4 max-w-[720px]">
          <PrototypeNote ccp={2} />
        </div>
      </Section>

      <Section title="What the signals say">
        <div className="space-y-4 max-w-[720px]">
          <div>
            <p className="text-[13px] font-medium text-slate-900">
              {series.highDemand
                ? `Demand for ${group} is expected to rise over the forecast period.`
                : `Demand for ${group} is expected to stay within its normal range.`}
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-slate-600">
              {series.highDemand
                ? `The prototype forecast peaks at ${series.peakProjected} units per day around ${series.peakLabel}, against a 30-day average of ${series.trailingMean}. A group is flagged when the projected peak reaches 118 percent of that average.`
                : `The projected peak of ${series.peakProjected} units per day stays below the threshold of 118 percent of the 30-day average of ${series.trailingMean}.`}
            </p>
          </div>

          <div>
            <p className="text-[13px] font-medium text-slate-900">
              {series.shortageRisk
                ? `Projected demand exceeds available cover by about ${series.projectedGap} units.`
                : 'Projected demand stays within available cover.'}
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-slate-600">
              {series.projectedTotal} units are projected over the next {FORECAST_DAYS} days.
              Cover is {series.currentUnits} units held plus {series.expectedCollection} units of
              expected routine collection, giving {series.projectedSupply} units.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Simulated scenario factors"
        description="Illustrative inputs used to shape the demonstration data. They are not real causal findings, and no such relationship has been measured or validated in this project."
      >
        <ul className="border border-slate-200 rounded-md divide-y divide-slate-100 max-w-[720px]">
          {scenarioFactors.map((factor) => (
            <li key={factor.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[13px] font-medium text-slate-900">{factor.label}</p>
                <span className="text-[11.5px] text-slate-500 shrink-0">
                  {factor.scope === 'forecast' ? 'Forecast window' : 'History window'}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-[1.6] text-slate-600">{factor.description}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 max-w-[720px]">
          <Footnote>
            The shaded band on the chart is an illustrative range included for legibility. It is
            not a fitted statistical prediction interval, and no accuracy or error measure is
            claimed for the forecast line.
          </Footnote>
        </div>
      </Section>
    </Page>
  );
}
