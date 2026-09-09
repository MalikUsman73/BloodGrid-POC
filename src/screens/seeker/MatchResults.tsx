/**
 * Ranked donor recommendations — the primary CCP 1 output screen.
 *
 * The five criteria bars shown on each donor are the objectives the FUTURE
 * NSGA-II implementation is intended to optimise over. They are displayed to
 * communicate the structure of the optimisation problem. The combined figure
 * is a PROTOTYPE MATCH SCORE and is never described as an NSGA-II result,
 * a Pareto-optimal solution, or a non-dominated solution.
 */

import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock, Filter, MapPin, Users,
} from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState, GroupChip, MeterBar } from '../../components/ui';
import { SimulatedNotice, SimulatedTag } from '../../components/SimulatedBadge';
import DonorMap from '../../components/map/DonorMap';
import { useApp } from '../../store/AppStore';
import { CRITERIA, WEIGHTS, runMatching } from '../../engines/matching';
import { donors } from '../../mock/donors';
import { availabilityTone, tierTone } from './shared';

export default function MatchResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getRequest } = useApp();
  const request = getRequest(id!);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const outcome = useMemo(
    () => (request ? runMatching(donors, { bloodGroup: request.bloodGroup, urgency: request.urgency }) : null),
    [request],
  );

  if (!request || !outcome) return <Navigate to="/seeker" replace />;

  const { results } = outcome;
  const selected = results.find((r) => r.donor.id === selectedId) ?? results[0];
  const weights = WEIGHTS[request.urgency];

  return (
    <>
      <PageHeader
        title="Ranked Donor Recommendations"
        subtitle={
          <>
            {results.length} suitable donor{results.length === 1 ? '' : 's'} identified for{' '}
            <strong className="text-slate-700">{request.units} unit{request.units > 1 ? 's' : ''} of {request.bloodGroup}</strong>{' '}
            ({request.urgency}, Sector {request.sector}).
          </>
        }
        breadcrumb={
          <Button to="/seeker" variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Button>
        }
        actions={
          <div className="flex items-center gap-2">
            <GroupChip group={request.bloodGroup} />
            <Badge tone={request.urgency === 'Critical' ? 'red' : request.urgency === 'Urgent' ? 'amber' : 'slate'}>
              {request.urgency}
            </Badge>
          </div>
        }
      />

      <PageBody className="space-y-5">
        <SimulatedNotice ccp={1} />

        {/* Screening summary — the filtering is shown, not hidden */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Screen label="Donor pool" value={outcome.poolSize} tone="text-slate-900" />
          <Screen label="Incompatible group" value={outcome.incompatibleCount} tone="text-slate-400" />
          <Screen label="Within donation interval" value={outcome.ineligibleCount} tone="text-slate-400" />
          <Screen label="Ranked donors" value={results.length} tone="text-crimson-600" />
        </div>

        {results.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="No suitable donors in the simulated pool"
              message="No donor in this prototype's demonstration pool is both compatible with the requested blood group and outside the minimum donation interval. Try a different blood group to see the matching engine produce results."
              action={<Button to="/seeker/request/new" size="sm">Create another request</Button>}
            />
          </Card>
        ) : (
          <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-5 items-start">

            {/* Ranked list */}
            <Card className="overflow-hidden">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    Prototype Match Score ranking <SimulatedTag ccp={1} />
                  </span>
                }
                subtitle={`Criteria weighting adapts to urgency — currently weighted for "${request.urgency}".`}
                icon={<Filter className="w-4 h-4" />}
              />

              <ul className="divide-y divide-slate-100">
                {results.map((r) => {
                  const d = r.donor;
                  const isSelected = d.id === selected?.donor.id;
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => setSelectedId(d.id)}
                        onPointerEnter={() => setHoveredId(d.id)}
                        onPointerLeave={() => setHoveredId(null)}
                        className={`w-full text-left px-5 py-4 transition-colors ${
                          isSelected ? 'bg-crimson-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <span
                            className={`w-7 h-7 shrink-0 grid place-items-center rounded-lg text-xs font-bold nums ${
                              r.rank <= 3 ? 'bg-crimson-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {r.rank}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                              <Badge tone="red">{d.bloodGroup}</Badge>
                              <Badge tone={tierTone(r.tier)}>{r.tier} match</Badge>
                              {d.verified && (
                                <span title="Verified donor record (simulated)">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Sector {d.sector} · {d.distanceKm} km
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Last donated {d.lastDonationDays} days ago
                              </span>
                              <Badge tone={availabilityTone(d.availability)}>{d.availability}</Badge>
                            </p>

                            {/* Objective criteria breakdown */}
                            <div className="mt-3 grid grid-cols-5 gap-2">
                              {CRITERIA.map((c) => (
                                <div key={c.key} title={c.hint}>
                                  <MeterBar
                                    value={r.objectives[c.key]}
                                    tone={isSelected ? 'crimson' : 'sky'}
                                  />
                                  <p className="mt-1 text-[9px] leading-3 text-slate-400 truncate">
                                    {c.label}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="text-right shrink-0 pl-1">
                            <p className="text-xl font-semibold text-slate-900 nums leading-none">{r.score}</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-3">Prototype<br />Match Score</p>
                            <ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-2" />
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  The five bars are the criteria the ranking balances: compatibility, proximity,
                  availability, donation recency and reliability. These are the objectives the
                  future NSGA-II implementation will optimise over. Current weighting for{' '}
                  <strong className="text-slate-600">{request.urgency}</strong>:{' '}
                  {CRITERIA.map((c) => `${c.label} ${Math.round(weights[c.key] * 100)}%`).join(' · ')}.
                </p>
              </div>
            </Card>

            {/* Map + selected donor */}
            <div className="space-y-4 xl:sticky xl:top-20">
              <Card className="overflow-hidden">
                <CardHeader
                  title="Donor map"
                  subtitle="Approximate sector-level locations — offline schematic map"
                  icon={<MapPin className="w-4 h-4" />}
                />
                <DonorMap
                  results={results}
                  selectedId={selected?.donor.id ?? null}
                  hoveredId={hoveredId}
                  onSelect={setSelectedId}
                  onHover={setHoveredId}
                  className="h-[360px] sm:h-[420px] border-0 rounded-none"
                />
              </Card>

              {selected && (
                <Card className="animate-fadeUp">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <GroupChip group={selected.donor.bloodGroup} size="lg" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {selected.donor.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Rank #{selected.rank} · Sector {selected.donor.sector} · {selected.donor.distanceKm} km
                          </p>
                        </div>
                      </div>
                      <Badge tone={tierTone(selected.tier)}>{selected.tier}</Badge>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        full
                        onClick={() => navigate(`/seeker/request/${request.id}/donor/${selected.donor.id}`)}
                      >
                        View donor details <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Screen({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold nums ${tone}`}>{value}</p>
    </Card>
  );
}
