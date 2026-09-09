/**
 * Planning recommendations.
 *
 * These are workflow prompts derived from the SIMULATED forecast by simple,
 * explainable threshold rules. They are decision support for a human
 * administrator — the prototype takes no autonomous action.
 *
 * NOTE ON SCOPE: the coordination action below is an ordinary application
 * workflow. It performs no optimisation, no redistribution planning, and no
 * routing. It is not a third computational component.
 */

import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Radio, Send, TrendingUp, Users,
} from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState } from '../../components/ui';
import { IllustrativeNote, SimulatedTag } from '../../components/SimulatedBadge';
import { getSeries, planningInsights } from '../../engines/forecast';
import { donors } from '../../mock/donors';
import { COMPATIBILITY } from '../../engines/matching';
import { FORECAST_DAYS } from '../../mock/demand';
import { severityTone } from './shared';

export default function Planning() {
  const insights = planningInsights();

  return (
    <>
      <PageHeader
        title="Planning Recommendations"
        subtitle="Actions suggested by the prototype forecast signals. Every action requires administrator confirmation."
      />

      <PageBody className="space-y-5">
        {insights.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 className="w-8 h-8" />}
              title="No planning actions flagged"
              message="No blood group currently exceeds the prototype's elevated-demand or shortage-risk thresholds."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => {
              const s = getSeries(insight.bloodGroup);
              const eligibleDonors = donors.filter(
                (d) => COMPATIBILITY[insight.bloodGroup].includes(d.bloodGroup) && d.eligible,
              ).length;

              return (
                <Card key={insight.id} className={insight.severity === 'critical' ? 'border-red-200' : 'border-amber-200'}>
                  <div className={`px-5 py-4 border-b ${
                    insight.severity === 'critical'
                      ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-9 h-9 shrink-0 grid place-items-center rounded-lg border ${
                        insight.severity === 'critical'
                          ? 'bg-red-100 border-red-200' : 'bg-amber-100 border-amber-200'
                      }`}>
                        {insight.severity === 'critical'
                          ? <AlertTriangle className="w-4 h-4 text-red-600" />
                          : <TrendingUp className="w-4 h-4 text-amber-600" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className={`text-sm font-semibold ${
                            insight.severity === 'critical' ? 'text-red-900' : 'text-amber-900'
                          }`}>
                            {insight.headline}
                          </h2>
                          <Badge tone={severityTone(insight.severity)}>
                            {insight.severity === 'critical' ? 'Shortage risk' : 'Elevated demand'}
                          </Badge>
                          <SimulatedTag ccp={2} />
                        </div>
                        <p className={`mt-1 text-xs leading-relaxed ${
                          insight.severity === 'critical' ? 'text-red-800/90' : 'text-amber-800/90'
                        }`}>
                          {insight.detail}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid sm:grid-cols-3 gap-3 mb-4">
                      <Metric label="Peak projected" value={`${s.peakProjected}`} unit="units/day" sub={`around ${s.peakLabel}`} />
                      <Metric label={`${FORECAST_DAYS}-day demand`} value={`${s.projectedTotal}`} unit="units" sub={`vs ${s.projectedSupply} units cover`} />
                      <Metric label="Compatible eligible donors" value={`${eligibleDonors}`} unit="donors" sub="in the simulated pool" />
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                      Available actions
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2.5">
                      <ActionLink
                        to={`/bank/outreach?group=${encodeURIComponent(insight.bloodGroup)}`}
                        icon={Radio}
                        title="Launch donor outreach"
                        body={`Prepare an outreach campaign to ${insight.bloodGroup}-compatible donors.`}
                      />
                      <ActionLink
                        to={`/bank/outreach?group=${encodeURIComponent(insight.bloodGroup)}&available=1`}
                        icon={Users}
                        title="Contact available donors"
                        body="Target donors currently marked available."
                      />
                      <ActionLink
                        to={`/bank/coordination?group=${encodeURIComponent(insight.bloodGroup)}&units=${s.projectedGap || 20}`}
                        icon={Send}
                        title="Request inter-bank coordination"
                        body="Raise a coordination request with a partner facility."
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="bg-slate-50">
          <div className="p-5 space-y-2">
            <IllustrativeNote>
              These recommendations are produced by simple threshold rules applied to the
              prototype's simulated forecast — a group is flagged when projected peak demand
              exceeds 118% of the 30-day trailing average, or when projected demand exceeds held
              stock plus expected routine collection. No trained model, optimisation algorithm, or
              autonomous decision process is involved.
            </IllustrativeNote>
            <IllustrativeNote>
              Inter-bank coordination is an ordinary application workflow in BloodGrid. It is not a
              computational component of the project and performs no redistribution or
              transportation optimisation.
            </IllustrativeNote>
          </div>
        </Card>
      </PageBody>
    </>
  );
}

function Metric({ label, value, unit, sub }: { label: string; value: string; unit: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900 nums">
        {value}<span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function ActionLink({
  to, icon: Icon, title, body,
}: { to: string; icon: React.ElementType; title: string; body: string }) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-slate-200 p-3.5 hover:border-crimson-300 hover:shadow-card transition-all"
    >
      <Icon className="w-4 h-4 text-crimson-600" />
      <p className="mt-2 text-xs font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{body}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-crimson-700 group-hover:gap-2 transition-all">
        Open <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}
