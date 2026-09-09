/**
 * Blood-bank dashboard — inventory position plus the headline signal derived
 * from the SIMULATED forecast (CCP 2).
 */

import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Building2, Droplet, LineChart, Package, TrendingUp,
} from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, MeterBar, StatTile } from '../../components/ui';
import { SimulatedTag } from '../../components/SimulatedBadge';
import { DemandSparkline } from '../../components/charts/DemandChart';
import { OWN_BANK, inventory, totalCapacity, totalUnits } from '../../mock/banks';
import { getSeries, planningInsights } from '../../engines/forecast';
import { FORECAST_GROUPS } from '../../mock/demand';
import { stockTone } from './shared';

export default function BankDashboard() {
  const insights = planningInsights();
  const critical = insights.filter((i) => i.severity === 'critical');
  const lowStock = inventory.filter((i) => i.status === 'Critical' || i.status === 'Low');

  return (
    <>
      <PageHeader
        title="Blood Bank Dashboard"
        subtitle={`${OWN_BANK.name} · Sector ${OWN_BANK.sector} — current inventory position and forward demand signals.`}
        actions={
          <Button to="/bank/demand">
            <LineChart className="w-4 h-4" /> Demand & Forecast
          </Button>
        }
      />

      <PageBody className="space-y-6">
        {/* Headline signal from CCP 2 */}
        {critical.length > 0 && (
          <Card className="border-red-200 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-red-50">
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-lg bg-red-100 border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-red-900">{critical[0].headline}</h2>
                  <SimulatedTag ccp={2} />
                </div>
                <p className="mt-1 text-xs text-red-800/90 leading-relaxed">{critical[0].detail}</p>
              </div>
              <Button to="/bank/planning" className="shrink-0">
                View planning actions <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Total units held" value={totalUnits}
            icon={<Package className="w-4 h-4" />}
            hint={`${Math.round((totalUnits / totalCapacity) * 100)}% of ${totalCapacity} unit capacity`}
          />
          <StatTile
            label="Groups below target" value={lowStock.length}
            tone={lowStock.length > 0 ? 'red' : 'green'}
            icon={<Droplet className="w-4 h-4" />}
            hint={lowStock.map((i) => i.bloodGroup).join(', ') || 'All groups at healthy levels'}
          />
          <StatTile
            label="Elevated-demand groups" value={insights.length}
            tone={insights.length > 0 ? 'amber' : 'green'}
            icon={<TrendingUp className="w-4 h-4" />}
            hint="Flagged by the prototype forecast"
          />
          <StatTile
            label="Partner facilities" value={3}
            icon={<Building2 className="w-4 h-4" />}
            hint="Available for coordination requests"
          />
        </div>

        {/* Inventory */}
        <Card>
          <CardHeader
            title="Current inventory"
            subtitle="Simulated stock position by blood group"
            icon={<Package className="w-4 h-4" />}
            action={<SimulatedTag />}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <Th>Group</Th>
                  <Th>Units held</Th>
                  <Th>Level</Th>
                  <Th>Days of cover</Th>
                  <Th>Status</Th>
                  <Th>30-day trend</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => {
                  const forecastable = FORECAST_GROUPS.includes(item.bloodGroup);
                  return (
                    <tr key={item.bloodGroup} className="hover:bg-slate-50 transition-colors">
                      <Td>
                        <span className="inline-flex items-center justify-center w-9 h-8 rounded-md bg-crimson-50 text-crimson-700 border border-crimson-200 text-xs font-bold nums">
                          {item.bloodGroup}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-semibold text-slate-900 nums">{item.units}</span>
                        <span className="text-slate-400 nums"> / {item.capacity}</span>
                      </Td>
                      <Td className="w-40">
                        <MeterBar
                          value={item.units / item.capacity}
                          tone={
                            item.status === 'Critical' ? 'red'
                            : item.status === 'Low' ? 'amber'
                            : item.status === 'Watch' ? 'sky' : 'emerald'
                          }
                        />
                      </Td>
                      <Td className="nums text-slate-600">{item.daysOfCover} days</Td>
                      <Td><Badge tone={stockTone(item.status)}>{item.status}</Badge></Td>
                      <Td className="w-32">
                        {forecastable ? (
                          <DemandSparkline series={getSeries(item.bloodGroup)} height={32} />
                        ) : (
                          <span className="text-[11px] text-slate-400">Not modelled in prototype</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Simulated inventory for demonstration. Four blood groups (O+, A+, B+, AB+) carry a
              prototype demand series; the remainder are shown for inventory context only.
            </p>
          </div>
        </Card>

        {/* Forward signals */}
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2">Forward demand signals <SimulatedTag ccp={2} /></span>}
            subtitle="Derived from the prototype forecast by simple threshold rules"
            icon={<TrendingUp className="w-4 h-4" />}
            action={
              <Button to="/bank/demand" variant="ghost" size="sm">
                Open forecast <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            }
          />
          <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FORECAST_GROUPS.map((g) => {
              const s = getSeries(g);
              const tone = s.shortageRisk ? 'red' : s.highDemand ? 'amber' : 'green';
              const label = s.shortageRisk ? 'Shortage risk' : s.highDemand ? 'Elevated demand' : 'Stable';
              return (
                <Link
                  key={g} to={`/bank/demand?group=${encodeURIComponent(g)}`}
                  className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-card transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-crimson-700 nums">{g}</span>
                    <Badge tone={tone}>{label}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Peak projected</p>
                  <p className="text-lg font-semibold text-slate-900 nums">
                    {s.peakProjected}
                    <span className="text-xs font-normal text-slate-400 ml-1">units/day</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    vs {s.trailingMean} avg · around {s.peakLabel}
                  </p>
                </Link>
              );
            })}
          </div>
        </Card>
      </PageBody>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
