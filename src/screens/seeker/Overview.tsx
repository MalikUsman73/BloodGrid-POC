import { Link } from 'react-router-dom';
import {
  BloodGroup, Button, EmptyState, Eyebrow, Page, PageTitle, Status, StatusDot,
  Surface, SurfaceHeader, Table, Td, Th,
} from '../../components/ui';
import type { Donor } from '../../types';
import { useApp } from '../../store/AppStore';
import { requestStatusTone, urgencyTone } from '../../lib/status';
import { pluralDonors, pluralUnits } from '../../lib/format';
import { COMPATIBLE_DONOR_GROUPS, isContactable } from '../../engines/matching';

/** Availability across the pool, for the donor panel. */
function poolBreakdown(donors: Donor[]) {
  const eligible = donors.filter((donor) => donor.eligible);
  const available = eligible.filter((donor) => donor.available);

  const byGroup = new Map<string, number>();
  for (const donor of available) {
    byGroup.set(donor.bloodGroup, (byGroup.get(donor.bloodGroup) ?? 0) + 1);
  }

  return {
    registered: donors.length,
    eligible: eligible.length,
    available: available.length,
    byGroup: [...byGroup.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export default function SeekerOverview() {
  const { requests, donorRequestsFor, donors } = useApp();
  const pool = poolBreakdown(donors);

  const openRequests = requests.filter((request) => request.status !== 'Fulfilled');
  const activeRequest = openRequests[0];
  const activeContacts = activeRequest ? donorRequestsFor(activeRequest.id) : [];
  const acceptedContact = activeContacts.find((entry) => entry.state === 'Accepted');

  const reachableForActive = activeRequest
    ? donors.filter(
        (donor) =>
          COMPATIBLE_DONOR_GROUPS[activeRequest.bloodGroup].includes(donor.bloodGroup) &&
          donor.eligible && isContactable(donor),
      ).length
    : 0;

  return (
    <Page>
      <PageTitle
        title="Blood requests"
        description="Raise a request for a patient and review the donors BloodGrid suggests."
        actions={<Button variant="primary" to="/seeker/request/new">Create blood request</Button>}
      />

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Active request, the thing a seeker actually returns here to check */}
        <Surface className="lg:col-span-2">
          <SurfaceHeader
            title="Active request"
            actions={
              activeRequest && (
                <Status tone={requestStatusTone(activeRequest.status)}>{activeRequest.status}</Status>
              )
            }
          />
          {activeRequest ? (
            <div className="p-5">
              <div className="flex flex-wrap items-start gap-5">
                <BloodGroup group={activeRequest.bloodGroup} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-slate-900">
                    {activeRequest.patientRef}
                    <span className="ml-2 font-normal text-slate-500">
                      {pluralUnits(activeRequest.units)}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] text-slate-600">
                    {activeRequest.facility}, Sector {activeRequest.sector}. Raised{' '}
                    {activeRequest.createdLabel}.
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <Status tone={urgencyTone(activeRequest.urgency)}>{activeRequest.urgency}</Status>
                    <StatusDot tone={activeContacts.length > 0 ? 'info' : 'neutral'}>
                      {activeContacts.length === 0
                        ? 'No donors contacted yet'
                        : `${activeContacts.length} contacted`}
                    </StatusDot>
                    <StatusDot tone="neutral">{reachableForActive} compatible donors available</StatusDot>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {acceptedContact ? (
                  <Button
                    variant="primary"
                    to={`/seeker/request/${activeRequest.id}/conversation/${acceptedContact.donorId}`}
                  >
                    Open conversation
                  </Button>
                ) : (
                  <Button variant="primary" to={`/seeker/request/${activeRequest.id}/matches`}>
                    View donors
                  </Button>
                )}
                <Button to="/seeker/requests">All requests</Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No open requests"
              message="Create a blood request and BloodGrid will screen the donor pool and rank suitable donors."
              action={<Button variant="primary" size="sm" to="/seeker/request/new">Create blood request</Button>}
            />
          )}
        </Surface>

        {/* Donor pool */}
        <Surface>
          <SurfaceHeader title="Donor pool" />
          <div className="p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-[30px] font-semibold text-slate-900 tabular-nums leading-none">
                {pool.available}
              </span>
              <span className="text-[13px] text-slate-500">available now</span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-slate-500">
              of {pool.eligible} eligible, {pool.registered} registered
            </p>

            <div className="mt-4 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${(pool.available / pool.registered) * 100}%` }}
              />
            </div>

            <Eyebrow className="mt-5">Available by group</Eyebrow>
            <ul className="mt-2.5 space-y-1.5">
              {pool.byGroup.map(([group, count]) => (
                <li key={group} className="flex items-center gap-3">
                  <span className="w-11 text-[13px] font-medium text-crimson-800 tabular-nums">
                    {group}
                  </span>
                  <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-crimson-500"
                      style={{ width: `${(count / pool.available) * 100}%` }}
                    />
                  </span>
                  <span className="w-4 text-right text-[13px] text-slate-600 tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Surface>
      </div>

      <Surface>
        <SurfaceHeader
          title="All requests"
          description="Every request raised from this account in the current session."
        />
        {requests.length === 0 ? (
          <EmptyState
            title="No requests yet"
            message="Requests you raise will appear here with their current status."
            action={<Button variant="primary" size="sm" to="/seeker/request/new">Create blood request</Button>}
          />
        ) : (
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Case</Th>
                <Th>Group</Th>
                <Th align="right">Units</Th>
                <Th>Urgency</Th>
                <Th>Sector</Th>
                <Th>Raised</Th>
                <Th align="right">Contacted</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => {
                const contacts = donorRequestsFor(request.id);
                return (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <Td>
                      <span className="font-medium text-slate-900">{request.patientRef}</span>
                      <span className="block text-[12px] text-slate-500 tabular-nums">{request.id}</span>
                    </Td>
                    <Td><BloodGroup group={request.bloodGroup} size="sm" /></Td>
                    <Td align="right" className="tabular-nums">{request.units}</Td>
                    <Td><Status tone={urgencyTone(request.urgency)}>{request.urgency}</Status></Td>
                    <Td className="text-slate-600">{request.sector}</Td>
                    <Td className="text-slate-600 whitespace-nowrap">{request.createdLabel}</Td>
                    <Td align="right" className="tabular-nums text-slate-600">
                      {contacts.length || <span className="text-slate-400">0</span>}
                    </Td>
                    <Td><Status tone={requestStatusTone(request.status)}>{request.status}</Status></Td>
                    <Td align="right">
                      <Link
                        to={`/seeker/request/${request.id}/matches`}
                        className="text-[13px] font-medium text-crimson-800 hover:underline whitespace-nowrap"
                      >
                        View donors
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Surface>

      <p className="mt-5 text-[12.5px] leading-[1.6] text-slate-500 max-w-[80ch]">
        When you raise a request, BloodGrid screens the pool for blood-group compatibility and
        donation eligibility, then ranks the remaining donors by proximity, availability, donation
        recency and reliability. {pluralDonors(pool.registered)} are registered in this prototype.
      </p>
    </Page>
  );
}
