/**
 * Donor detail and contact action.
 *
 * Contact details are masked. This prototype sends nothing: there is no SMS,
 * email, push, or messaging integration, and none is required for the proposal
 * defense. The action records the contact in local session state so the
 * workflow can be demonstrated end to end.
 */

import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, Droplet, MapPin, Phone, Send, ShieldCheck, Users,
} from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, GroupChip, MeterBar } from '../../components/ui';
import { IllustrativeNote, SimulatedNotice, SimulatedTag } from '../../components/SimulatedBadge';
import DonorMap from '../../components/map/DonorMap';
import { useApp } from '../../store/AppStore';
import { CRITERIA, runMatching } from '../../engines/matching';
import { donors } from '../../mock/donors';
import { availabilityTone, tierTone } from './shared';

export default function DonorDetail() {
  const { id, donorId } = useParams();
  const navigate = useNavigate();
  const { getRequest, contactDonor } = useApp();
  const request = getRequest(id!);
  const [sending, setSending] = useState(false);

  const outcome = useMemo(
    () => (request ? runMatching(donors, { bloodGroup: request.bloodGroup, urgency: request.urgency }) : null),
    [request],
  );

  if (!request || !outcome) return <Navigate to="/seeker" replace />;

  const match = outcome.results.find((r) => r.donor.id === donorId);
  if (!match) return <Navigate to={`/seeker/request/${request.id}/matches`} replace />;

  const d = match.donor;
  const alreadyContacted = request.contactedDonorIds.includes(d.id);

  const send = () => {
    setSending(true);
    // Brief delay so the transition reads as an action, not an instant jump.
    setTimeout(() => {
      contactDonor(request.id, d.id);
      navigate(`/seeker/request/${request.id}/sent?donor=${d.id}`);
    }, 600);
  };

  return (
    <>
      <PageHeader
        title={d.name}
        subtitle={`Rank #${match.rank} of ${outcome.results.length} for ${request.bloodGroup} · ${request.urgency} · Sector ${request.sector}`}
        breadcrumb={
          <Button to={`/seeker/request/${request.id}/matches`} variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to ranked donors
          </Button>
        }
        actions={<Badge tone={tierTone(match.tier)}>{match.tier} match</Badge>}
      />

      <PageBody>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-5 items-start">
          <div className="space-y-5">
            <Card>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <GroupChip group={d.bloodGroup} size="lg" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">{d.name}</h2>
                        {d.verified && (
                          <span title="Verified donor record (simulated)">
                            <CheckCircle2 className="w-4 h-4 text-sky-500" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {d.id} · Age {d.age} · {d.completedDonations} previous donations
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-semibold text-slate-900 nums leading-none">{match.score}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Prototype Match Score</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Fact icon={MapPin} label="Location" value={`Sector ${d.sector}`} sub={`${d.distanceKm} km away`} />
                  <Fact icon={Users} label="Availability" value={d.availability}
                        badge={availabilityTone(d.availability)} />
                  <Fact icon={Clock} label="Last donation" value={`${d.lastDonationDays} days`} sub="ago" />
                  <Fact icon={Droplet} label="Eligibility" value={d.eligible ? 'Eligible' : 'Not eligible'}
                        sub="90-day interval rule" />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    Criteria breakdown <SimulatedTag ccp={1} />
                  </span>
                }
                subtitle="The five objectives the future NSGA-II implementation will optimise over"
              />
              <div className="p-5 space-y-4">
                {CRITERIA.map((c) => (
                  <div key={c.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs font-medium text-slate-700">{c.label}</p>
                      <p className="text-xs text-slate-500 nums">
                        {Math.round(match.objectives[c.key] * 100)}
                        <span className="text-slate-400">/100</span>
                      </p>
                    </div>
                    <MeterBar value={match.objectives[c.key]} className="mt-1.5" />
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{c.hint}</p>
                  </div>
                ))}
                <IllustrativeNote className="pt-2 border-t border-slate-100">
                  These criteria values are produced by the prototype's deterministic scoring
                  routine for demonstration purposes. No optimisation algorithm has been run and
                  no Pareto front has been computed.
                </IllustrativeNote>
              </div>
            </Card>

            <SimulatedNotice ccp={1} />
          </div>

          {/* Contact panel + map */}
          <div className="space-y-4 lg:sticky lg:top-20">
            <Card>
              <CardHeader title="Contact this donor" subtitle="Prototype workflow — no message is actually sent" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 nums">{d.contactMasked}</p>
                    <p className="text-[11px] text-slate-500">Masked in this prototype</p>
                  </div>
                </div>

                {alreadyContacted ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-emerald-900 leading-relaxed">
                      A request has already been sent to this donor for {request.patientRef}.
                    </p>
                  </div>
                ) : (
                  <Button full size="lg" onClick={send} disabled={sending}>
                    {sending ? 'Sending request…' : <>Send Blood Request <Send className="w-4 h-4" /></>}
                  </Button>
                )}

                <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0 text-emerald-600" />
                  Contact numbers are masked and donor addresses are never displayed. Real
                  notification delivery is scheduled for the implementation phase.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Approximate location" subtitle={`Sector ${d.sector} — offline schematic map`} />
              <DonorMap
                results={outcome.results}
                selectedId={d.id}
                onSelect={(nid) => navigate(`/seeker/request/${request.id}/donor/${nid}`)}
                className="h-[280px] border-0 rounded-none"
              />
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Fact({
  icon: Icon, label, value, sub, badge,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  badge?: 'green' | 'amber' | 'slate';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="w-3 h-3" /> {label}
      </p>
      {badge ? (
        <Badge tone={badge} className="mt-1.5">{value}</Badge>
      ) : (
        <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      )}
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
