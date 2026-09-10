import { Link } from 'react-router-dom';
import { Button, EmptyState, Page, PageTitle, Section, Status, Table, Td, Th, BloodGroup } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { requestStatusTone, urgencyTone } from '../../lib/status';
import { pluralUnits } from '../../lib/format';
import { donors } from '../../mock/donors';

export default function SeekerOverview() {
  const { requests } = useApp();
  const openRequests = requests.filter((request) => request.status !== 'Fulfilled');
  const availableDonors = donors.filter(
    (donor) => donor.availability === 'Available' && donor.eligible,
  ).length;

  return (
    <Page>
      <PageTitle
        title="Blood requests"
        description="Raise a request for a patient and review the donors BloodGrid suggests."
        actions={<Button variant="primary" to="/seeker/request/new">Create blood request</Button>}
      />

      <Section title="Your requests" divide={false}>
        {requests.length === 0 ? (
          <EmptyState
            title="No requests yet"
            message="Create a blood request to see suitable donors ranked by BloodGrid."
            action={<Button variant="primary" size="sm" to="/seeker/request/new">Create blood request</Button>}
          />
        ) : (
          <Table minWidth={680}>
            <thead>
              <tr>
                <Th>Case</Th>
                <Th>Group</Th>
                <Th>Units</Th>
                <Th>Urgency</Th>
                <Th>Raised</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="font-medium text-slate-900">{request.patientRef}</span>
                    <span className="block text-[11.5px] text-slate-500 tabular-nums">{request.id}</span>
                  </Td>
                  <Td><BloodGroup group={request.bloodGroup} size="sm" /></Td>
                  <Td className="tabular-nums">{request.units}</Td>
                  <Td><Status tone={urgencyTone(request.urgency)}>{request.urgency}</Status></Td>
                  <Td className="text-slate-600 whitespace-nowrap">{request.createdLabel}</Td>
                  <Td><Status tone={requestStatusTone(request.status)}>{request.status}</Status></Td>
                  <Td align="right">
                    <Link
                      to={`/seeker/request/${request.id}/matches`}
                      className="text-[12.5px] font-medium text-crimson-800 hover:underline whitespace-nowrap"
                    >
                      View donors
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Donor pool">
        <p className="text-[13px] leading-relaxed text-slate-600 max-w-[70ch]">
          {donors.length} donors are registered in this prototype and {availableDonors} are
          currently eligible and available. When you raise a request, BloodGrid screens the pool
          for blood-group compatibility and donation eligibility, then ranks the remaining donors
          by proximity, availability, donation recency and reliability.
        </p>
        <p className="mt-3 text-[12.5px] text-slate-500">
          {openRequests.length === 0
            ? 'You have no open requests.'
            : `You have ${openRequests.length} open ${openRequests.length === 1 ? 'request' : 'requests'} totalling ${pluralUnits(openRequests.reduce((total, request) => total + request.units, 0))}.`}
        </p>
      </Section>
    </Page>
  );
}
