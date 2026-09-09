/**
 * Historical demand and PROTOTYPE FORECAST — the primary CCP 2 output screen.
 *
 * Nothing on this screen is produced by a trained model. No accuracy, error
 * metric, or confidence level is computed or shown. The scenario factors listed
 * are illustrative simulated inputs to the demonstration data, not measured or
 * validated causal effects.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarRange, Info, LineChart, TrendingUp,
} from 'lucide-react';
import type { BloodGroup } from '../../types';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, StatTile } from '../../components/ui';
import { IllustrativeNote, SimulatedNotice, SimulatedTag } from '../../components/SimulatedBadge';
import DemandChart from '../../components/charts/DemandChart';
import { getSeries } from '../../engines/forecast';
import { FORECAST_DAYS, FORECAST_GROUPS, HISTORY_DAYS, scenarioFactors } from '../../mock/demand';

export default function DemandForecast() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get('group') as BloodGroup) ?? 'O+';
  const [group, setGroup] = useState<BloodGroup>(
    FORECAST_GROUPS.includes(initial) ? initial : 'O+',
  );

  const s = getSeries(group);

  const select = (g: BloodGroup) => {
    setGroup(g);
    setParams({ group: g }, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Demand & Forecast"
        subtitle={`${HISTORY_DAYS} days of simulated recorded demand followed by a ${FORECAST_DAYS}-day prototype forecast.`}
        actions={
          <Button to="/bank/planning">
            <AlertTriangle className="w-4 h-4" /> Planning actions
          </Button>
        }
      />

      <PageBody className="space-y-5">
        <SimulatedNotice ccp={2} />

        {/* Group selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">Blood group:</span>
          {FORECAST_GROUPS.map((g) => {
            const gs = getSeries(g);
            const active = g === group;
            return (
              <button
                key={g} onClick={() => select(g)} aria-pressed={active}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  active ? 'bg-crimson-600 border-crimson-600 text-white shadow-sm'
                         : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className="nums">{g}</span>
                {(gs.shortageRisk || gs.highDemand) && (
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    active ? 'bg-white/80' : gs.shortageRisk ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Signals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="30-day average" value={s.trailingMean} unit="units/day"
            icon={<LineChart className="w-4 h-4" />}
            hint="Trailing mean of simulated recorded demand"
          />
          <StatTile
            label="Peak projected" value={s.peakProjected} unit="units/day"
            tone={s.highDemand ? 'amber' : 'slate'}
            icon={<TrendingUp className="w-4 h-4" />}
            hint={`Around ${s.peakLabel} in the prototype forecast`}
          />
          <StatTile
            label={`${FORECAST_DAYS}-day projected demand`} value={s.projectedTotal} unit="units"
            icon={<CalendarRange className="w-4 h-4" />}
            hint={`Against ${s.projectedSupply} units of projected cover`}
          />
          <StatTile
            label="Indicative shortfall" value={s.projectedGap} unit="units"
            tone={s.shortageRisk ? 'red' : 'green'}
            icon={<AlertTriangle className="w-4 h-4" />}
            hint={s.shortageRisk ? 'Projected demand exceeds cover' : 'Cover exceeds projected demand'}
          />
        </div>

        {/* Signal banners */}
        <div className="grid md:grid-cols-2 gap-3">
          <SignalCard
            active={s.highDemand}
            tone="amber"
            icon={TrendingUp}
            title={s.highDemand ? `Expected ${group} demand increase in the next forecast period` : `No elevated ${group} demand period flagged`}
            body={
              s.highDemand
                ? `The prototype forecast peaks at ${s.peakProjected} units/day around ${s.peakLabel}, against a 30-day trailing average of ${s.trailingMean} units/day.`
                : `The prototype forecast stays within the normal band relative to the 30-day trailing average of ${s.trailingMean} units/day.`
            }
          />
          <SignalCard
            active={s.shortageRisk}
            tone="red"
            icon={AlertTriangle}
            title={s.shortageRisk ? `${group} shortage risk in the forecast window` : `${group} cover is sufficient in the forecast window`}
            body={
              s.shortageRisk
                ? `Projected demand of ${s.projectedTotal} units exceeds ${s.currentUnits} units held plus ${s.expectedCollection} units of routine collection — an indicative shortfall of ${s.projectedGap} units.`
                : `Projected demand of ${s.projectedTotal} units sits within ${s.currentUnits} units held plus ${s.expectedCollection} units of expected routine collection.`
            }
          />
        </div>

        {/* Chart */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {group} demand — recorded and prototype forecast <SimulatedTag ccp={2} />
              </span>
            }
            subtitle="Solid line: simulated recorded demand. Dashed line: prototype forecast. Shaded band: illustrative range."
            icon={<LineChart className="w-4 h-4" />}
          />
          <div className="p-4 sm:p-5">
            <DemandChart series={s} />
            <IllustrativeNote className="mt-3">
              The shaded band is an illustrative range included for visual legibility. It is not a
              fitted statistical prediction interval, and no accuracy or error measure is claimed
              for the forecast line.
            </IllustrativeNote>
          </div>
        </Card>

        {/* Scenario factors */}
        <Card>
          <CardHeader
            title="Simulated scenario factors"
            subtitle="Illustrative inputs used to shape the demonstration dataset"
            icon={<Info className="w-4 h-4" />}
            action={<SimulatedTag />}
          />
          <ul className="divide-y divide-slate-100">
            {scenarioFactors.map((f) => (
              <li key={f.id} className="px-5 py-3.5 flex items-start gap-3">
                <Badge tone={f.scope === 'forecast' ? 'amber' : 'slate'} className="mt-0.5 shrink-0">
                  {f.scope === 'forecast' ? 'Forecast window' : 'History window'}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 bg-amber-50 border-t border-amber-200">
            <p className="text-[11px] text-amber-900 leading-relaxed">
              These factors are illustrative simulated scenario inputs used to make the
              demonstration data legible. They are not real causal findings, no such relationship
              has been measured or validated in this project, and no real-world data source has
              been used.
            </p>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button to="/bank/planning" size="lg">
            Review planning recommendations <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </PageBody>
    </>
  );
}

function SignalCard({
  active, tone, icon: Icon, title, body,
}: {
  active: boolean; tone: 'amber' | 'red'; icon: React.ElementType;
  title: string; body: string;
}) {
  const styles = active
    ? tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-slate-200 bg-white text-slate-600';
  const iconStyles = active ? (tone === 'red' ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600';

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${styles}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconStyles}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5">{title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{body}</p>
      </div>
    </div>
  );
}
