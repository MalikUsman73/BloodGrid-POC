/**
 * Requests waiting for the donor's response.
 *
 * Accepting is what opens the conversation for both sides, which is the point
 * of the communication model: contact happens in BloodGrid, after acceptance.
 */

import { Link } from 'react-router-dom';
import {
  BloodGroup as BloodGroupTag, Button, EmptyState, Notice, Page, PageTitle, Status,
} from '../../components/ui';
import { Footnote } from '../../components/PrototypeLabels';
import { DEMO_DONOR_ID, useApp } from '../../store/AppStore';
import { urgencyTone } from '../../lib/status';

export default function IncomingRequests() {
  const { donorInbox, findRequest, respondToRequest, findDonor } = useApp();
  const donor = findDonor(DEMO_DONOR_ID)!;
  const inbox = donorInbox();

  return (
    <Page>
      <PageTitle
        title="Requests"
        description={`Requests BloodGrid selected you for and notified you about. You were chosen by the matching engine, not picked by the seeker.`}
      />

      {inbox.length === 0 ? (
        <EmptyState
          title="No requests yet"
          message="Switch to the Seeker workspace, create a request and send it to this donor. It will appear here, showing both sides of the workflow inside one application."
          action={<Button variant="primary" size="sm" to="/seeker/request/new">Go to the Seeker workspace</Button>}
        />
      ) : (
        <ul className="space-y-4 max-w-[640px]">
          {inbox.map((entry) => {
            const request = findRequest(entry.requestId);
            if (!request) return null;
            const pending = entry.state === 'Sent';

            return (
              <li key={entry.requestId} className="border border-slate-200 rounded-lg shadow-surface">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-slate-900">
                    {request.patientRef}
                    <span className="ml-2 font-normal text-slate-500 tabular-nums">{request.id}</span>
                  </p>
                  <Status tone={entry.state === 'Accepted' ? 'good' : pending ? 'attention' : 'neutral'}>
                    {pending ? 'Awaiting your response' : entry.state}
                  </Status>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <BloodGroupTag group={request.bloodGroup} size="lg" />
                    <div className="min-w-0">
                      <p className="text-[13px] text-slate-900">
                        {request.units} {request.units === 1 ? 'unit' : 'units'} needed at {request.facility}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-slate-500">
                        Sector {request.sector}, sent {entry.sentLabel}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <Status tone={urgencyTone(request.urgency)}>{request.urgency}</Status>
                    </div>
                  </div>

                  {request.note && (
                    <p className="mt-4 text-[12.5px] leading-[1.6] text-slate-600 border-l-2 border-slate-200 pl-3">
                      {request.note}
                    </p>
                  )}

                  {pending && (
                    <div className="mt-5 flex gap-2.5">
                      <Button
                        variant="primary"
                        onClick={() => respondToRequest(request.id, donor.id, true, donor.name)}
                      >
                        Accept request
                      </Button>
                      <Button onClick={() => respondToRequest(request.id, donor.id, false, donor.name)}>
                        Decline
                      </Button>
                    </div>
                  )}

                  {entry.state === 'Accepted' && (
                    <div className="mt-5">
                      <Notice tone="good" title="You accepted this request">
                        The seeker can now see your name and reach you in BloodGrid. Your personal
                        contact details are not shared. Your donation record has been updated, so
                        you will not be asked again until the 90-day interval has passed.
                      </Notice>
                      <Link
                        to={`/donor/requests/${request.id}/conversation`}
                        className="mt-3 inline-block text-[12.5px] font-medium text-crimson-800 hover:underline"
                      >
                        Open conversation
                      </Link>
                    </div>
                  )}

                  {entry.state === 'Declined' && (
                    <p className="mt-5 text-[12.5px] text-slate-500">
                      You declined this request. BloodGrid notified other donors as well, so the
                      patient is still covered.
                    </p>
                  )}

                  {entry.state === 'Stood Down' && (
                    <div className="mt-5">
                      <Notice tone="neutral" title="Thank you, no longer needed">
                        Enough donors had already accepted by the time you responded, so this
                        request is covered. Your eligibility has not been used and you remain
                        available for future requests.
                      </Notice>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 max-w-[640px]">
        <Footnote>
          The donor workspace is a supporting part of the application. It is not a separate
          computational component: BloodGrid's two are donor matching optimisation and blood
          demand predictive analysis.
        </Footnote>
      </div>
    </Page>
  );
}
