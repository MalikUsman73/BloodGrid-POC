import { Link } from 'react-router-dom';
import {
  BloodGroup as BloodGroupTag, Button, EmptyState, Page, PageTitle,
  Status, Table, Td, Th,
} from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { findDonor } from '../../mock/donors';
import { requestStatusTone, urgencyTone } from '../../lib/status';

export default function MyRequests() {
  const { requests, donorRequestsFor } = useApp();

  return (
    <Page>
      <PageTitle
        title="My requests"
        description="Every request raised from this account in the current session."
        actions={<Button variant="primary" to="/seeker/request/new">Create blood request</Button>}
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
              <Th>Units</Th>
              <Th>Urgency</Th>
              <Th>Sector</Th>
              <Th>Raised</Th>
              <Th>Donors contacted</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => {
              const contacted = donorRequestsFor(request.id);
              const accepted = contacted.find((entry) => entry.state === 'Accepted');
              const acceptedDonor = accepted ? findDonor(accepted.donorId) : undefined;

              return (
                <tr key={request.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="font-medium text-slate-900">{request.patientRef}</span>
                    <span className="block text-[11.5px] text-slate-500 tabular-nums">{request.id}</span>
                  </Td>
                  <Td><BloodGroupTag group={request.bloodGroup} size="sm" /></Td>
                  <Td className="tabular-nums">{request.units}</Td>
                  <Td><Status tone={urgencyTone(request.urgency)}>{request.urgency}</Status></Td>
                  <Td className="text-slate-600">{request.sector}</Td>
                  <Td className="text-slate-600 whitespace-nowrap">{request.createdLabel}</Td>
                  <Td className="text-slate-600">
                    {contacted.length === 0 ? 'None' : `${contacted.length}`}
                  </Td>
                  <Td><Status tone={requestStatusTone(request.status)}>{request.status}</Status></Td>
                  <Td align="right">
                    {acceptedDonor ? (
                      <Link
                        to={`/seeker/request/${request.id}/conversation/${acceptedDonor.id}`}
                        className="text-[12.5px] font-medium text-crimson-800 hover:underline whitespace-nowrap"
                      >
                        Open conversation
                      </Link>
                    ) : (
                      <Link
                        to={`/seeker/request/${request.id}/matches`}
                        className="text-[12.5px] font-medium text-crimson-800 hover:underline whitespace-nowrap"
                      >
                        View donors
                      </Link>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Page>
  );
}
