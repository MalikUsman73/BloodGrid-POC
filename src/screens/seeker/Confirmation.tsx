/**
 * Request-sent confirmation.
 *
 * Success state closing the CCP 1 workflow. Nothing is transmitted — the
 * timeline below describes the prototype workflow, and the future-facing steps
 * are labelled as such.
 */

import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, ClipboardList, Clock, MapPin, Users } from 'lucide-react';
import { PageBody } from '../../components/layout/AppShell';
import { Badge, Button, Card, GroupChip } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { getDonor } from '../../mock/donors';

export default function Confirmation() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { getRequest } = useApp();
  const request = getRequest(id!);
  const donor = getDonor(params.get('donor') ?? '');

  if (!request) return <Navigate to="/seeker" replace />;

  const steps = [
    { label: 'Blood request created', done: true, note: request.createdLabel },
    { label: 'Donor pool screened and ranked', done: true, note: 'Prototype matching output' },
    { label: `Request sent to ${donor?.name ?? 'selected donor'}`, done: true, note: 'Recorded in this prototype session' },
    { label: 'Awaiting donor response', done: false, note: 'Donor responds from the Donor workspace' },
    { label: 'Donation scheduled and confirmed', done: false, note: 'Future implementation' },
  ];

  return (
    <PageBody>
      <div className="max-w-2xl mx-auto pt-4 sm:pt-8">
        <Card className="overflow-hidden animate-fadeUp">
          <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-emerald-50 to-white border-b border-slate-100">
            <span className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-emerald-100 border-4 border-white shadow-sm">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">Request sent</h1>
            <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              {donor
                ? <>Your blood request has been sent to <strong className="text-slate-800">{donor.name}</strong>.</>
                : <>Your blood request has been sent to the selected donor.</>}{' '}
              You can contact additional donors from the ranked list at any time.
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <GroupChip group={request.bloodGroup} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {request.units} unit{request.units > 1 ? 's' : ''} · {request.patientRef}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Sector {request.sector}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {request.createdLabel}</span>
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {request.contactedDonorIds.length} contacted</span>
                </p>
              </div>
              <Badge tone="blue">{request.status}</Badge>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Request timeline
              </p>
              <ol className="space-y-0">
                {steps.map((s, i) => (
                  <li key={s.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`w-5 h-5 shrink-0 grid place-items-center rounded-full border ${
                          s.done ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                        }`}
                      >
                        {s.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </span>
                      {i < steps.length - 1 && (
                        <span className={`w-px flex-1 min-h-[1.75rem] ${s.done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                      )}
                    </div>
                    <div className="pb-5 min-w-0">
                      <p className={`text-sm ${s.done ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                        {s.label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{s.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button to={`/seeker/request/${request.id}/matches`} variant="secondary" full>
                Back to ranked donors
              </Button>
              <Button to="/seeker/requests" full>
                <ClipboardList className="w-4 h-4" /> View my requests <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        <p className="mt-4 text-center text-[11px] text-slate-500 leading-relaxed">
          No message, SMS, email, or notification is transmitted by this prototype. Real
          notification delivery is scheduled for the implementation phase.
        </p>
      </div>
    </PageBody>
  );
}
