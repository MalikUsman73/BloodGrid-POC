/**
 * Donor incoming requests (Tier 2) — accept/decline, closing the workflow loop.
 * No real notification is delivered; responses are recorded in session state.
 */

import { useState } from 'react';
import { Bell, Building2, Check, CheckCircle2, Clock, MapPin, X } from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState, GroupChip } from '../../components/ui';
import { IllustrativeNote } from '../../components/SimulatedBadge';
import { useApp } from '../../store/AppStore';
import { DEMO_DONOR } from './shared';

export default function IncomingRequests() {
  const { requests, donorResponses, donorRespond } = useApp();
  const [justResponded, setJustResponded] = useState<string | null>(null);

  const mine = requests.filter((r) => r.contactedDonorIds.includes(DEMO_DONOR.id));

  const respond = (id: string, response: 'accepted' | 'declined') => {
    donorRespond(id, response);
    setJustResponded(id);
  };

  return (
    <>
      <PageHeader
        title="Incoming Requests"
        subtitle={`Blood requests sent to ${DEMO_DONOR.name} from the BloodGrid seeker workspace.`}
      />

      <PageBody className="space-y-5">
        {justResponded && donorResponses[justResponded] && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 animate-fadeUp">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Response recorded — request {donorResponses[justResponded]}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed">
                The seeker sees this status inside the same BloodGrid application. No message,
                SMS, or notification is transmitted by this prototype.
              </p>
            </div>
          </div>
        )}

        {mine.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bell className="w-8 h-8" />}
              title="No incoming requests"
              message="Switch to the Blood Seeker role, create a request, and send it to Ahmed Khan — it will appear here, demonstrating both sides of the workflow inside one application."
              action={<Button to="/seeker/request/new" size="sm">Go to Blood Seeker</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {mine.map((r) => {
              const response = donorResponses[r.id];
              return (
                <Card key={r.id} className={response ? '' : 'border-amber-200'}>
                  <CardHeader
                    title={`Request ${r.id}`}
                    subtitle={`Raised ${r.createdLabel}`}
                    action={
                      response
                        ? <Badge tone={response === 'accepted' ? 'green' : 'slate'}>
                            {response === 'accepted' ? 'Accepted' : 'Declined'}
                          </Badge>
                        : <Badge tone="amber" dot>Awaiting response</Badge>
                    }
                  />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-4">
                      <GroupChip group={r.bloodGroup} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {r.units} unit{r.units > 1 ? 's' : ''} of {r.bloodGroup} required
                        </p>
                        <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Sector {r.sector}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {r.hospital}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {r.createdLabel}
                          </span>
                        </p>
                      </div>
                      <Badge tone={r.urgency === 'Critical' ? 'red' : r.urgency === 'Urgent' ? 'amber' : 'slate'}>
                        {r.urgency}
                      </Badge>
                    </div>

                    {r.note && (
                      <p className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed">
                        “{r.note}”
                      </p>
                    )}

                    {!response && (
                      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                        <Button full onClick={() => respond(r.id, 'accepted')}>
                          <Check className="w-4 h-4" /> Accept request
                        </Button>
                        <Button full variant="secondary" onClick={() => respond(r.id, 'declined')}>
                          <X className="w-4 h-4" /> Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <IllustrativeNote>
          The donor experience is a supporting workflow. It is not a separate computational
          component — BloodGrid's two computational components are donor matching optimisation and
          blood demand predictive analysis.
        </IllustrativeNote>
      </PageBody>
    </>
  );
}
