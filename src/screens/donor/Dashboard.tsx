/**
 * Donor dashboard (Tier 2).
 *
 * Closes the coordination loop: a request sent from the seeker workspace
 * appears here for the donor to accept or decline, all inside one application.
 */

import { Bell, CalendarClock, CheckCircle2, Droplet, HeartHandshake, MapPin } from 'lucide-react';
import { PageBody, PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, GroupChip, StatTile } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { DEMO_DONOR } from './shared';

export default function DonorDashboard() {
  const { donorAvailable, setDonorAvailable, requests, donorResponses } = useApp();

  const incoming = requests.filter(
    (r) => r.contactedDonorIds.includes(DEMO_DONOR.id) && !donorResponses[r.id],
  );
  const responded = requests.filter((r) => donorResponses[r.id]);

  const nextEligible = Math.max(0, 90 - DEMO_DONOR.lastDonationDays);

  return (
    <>
      <PageHeader
        title="Donor Dashboard"
        subtitle={`${DEMO_DONOR.name} · Sector ${DEMO_DONOR.sector} — manage your availability and respond to requests.`}
        actions={
          incoming.length > 0 && (
            <Button to="/donor/requests">
              <Bell className="w-4 h-4" /> {incoming.length} incoming request{incoming.length === 1 ? '' : 's'}
            </Button>
          )
        }
      />

      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Blood group" value={DEMO_DONOR.bloodGroup}
            icon={<Droplet className="w-4 h-4" />} tone="red"
            hint="Universal-compatible with O+ recipients"
          />
          <StatTile
            label="Donations completed" value={DEMO_DONOR.completedDonations}
            icon={<HeartHandshake className="w-4 h-4" />}
            hint="Simulated donation history"
          />
          <StatTile
            label="Last donation" value={DEMO_DONOR.lastDonationDays} unit="days ago"
            icon={<CalendarClock className="w-4 h-4" />}
            hint={nextEligible === 0 ? 'Eligible to donate now' : `Eligible in ${nextEligible} days`}
          />
          <StatTile
            label="Incoming requests" value={incoming.length}
            tone={incoming.length > 0 ? 'amber' : 'slate'}
            icon={<Bell className="w-4 h-4" />}
            hint={incoming.length > 0 ? 'Awaiting your response' : 'Nothing awaiting response'}
          />
        </div>

        {/* Availability toggle */}
        <Card>
          <CardHeader
            title="Availability status"
            subtitle="Donors marked available are weighted more heavily in BloodGrid's matching"
          />
          <div className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`w-11 h-11 grid place-items-center rounded-lg border ${
                donorAvailable ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
              }`}>
                {donorAvailable
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  : <Droplet className="w-5 h-5 text-slate-400" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  You are currently {donorAvailable ? 'available' : 'unavailable'} to donate
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {donorAvailable
                    ? 'You may receive requests from nearby blood seekers.'
                    : 'You will not appear as available in donor recommendations.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDonorAvailable(!donorAvailable)}
              role="switch" aria-checked={donorAvailable}
              className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
                donorAvailable ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  donorAvailable ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Incoming */}
        <Card>
          <CardHeader
            title="Incoming blood requests"
            subtitle="Requests sent to you from the BloodGrid seeker workspace"
            icon={<Bell className="w-4 h-4" />}
            action={
              incoming.length > 0 && (
                <Button to="/donor/requests" variant="ghost" size="sm">Respond</Button>
              )
            }
          />
          {incoming.length === 0 && responded.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Bell className="w-7 h-7 text-slate-300 mx-auto" />
              <p className="mt-2 text-sm font-medium text-slate-700">No incoming requests</p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                When a blood seeker sends you a request from the seeker workspace, it will appear
                here. Try sending one from the Blood Seeker role to see the loop close.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...incoming, ...responded].map((r) => {
                const response = donorResponses[r.id];
                return (
                  <li key={r.id} className="px-5 py-3.5 flex items-center gap-4">
                    <GroupChip group={r.bloodGroup} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {r.units} unit{r.units > 1 ? 's' : ''} · {r.patientRef}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Sector {r.sector}
                        </span>
                        <span>{r.hospital}</span>
                      </p>
                    </div>
                    <Badge tone={r.urgency === 'Critical' ? 'red' : r.urgency === 'Urgent' ? 'amber' : 'slate'}>
                      {r.urgency}
                    </Badge>
                    {response
                      ? <Badge tone={response === 'accepted' ? 'green' : 'slate'}>
                          {response === 'accepted' ? 'Accepted' : 'Declined'}
                        </Badge>
                      : <Button to="/donor/requests" size="sm" variant="secondary">Respond</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
