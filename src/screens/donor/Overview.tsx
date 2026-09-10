/**
 * Donor overview.
 *
 * The donor side closes the loop: a request sent from the seeker workspace
 * arrives here, and accepting it is what opens the conversation for both sides.
 */

import { Button, Detail, DetailList, Page, PageTitle, Section, Status } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { findDonor } from '../../mock/donors';
import { DEMO_DONOR_ID } from '../../store/AppStore';
import { MIN_DAYS_BETWEEN_DONATIONS } from '../../mock/donors';

export default function DonorOverview() {
  const { donorAvailable, setDonorAvailable, donorInbox } = useApp();
  const donor = findDonor(DEMO_DONOR_ID)!;

  const inbox = donorInbox();
  const awaiting = inbox.filter((entry) => entry.state === 'Sent');
  const daysUntilEligible = Math.max(0, MIN_DAYS_BETWEEN_DONATIONS - donor.lastDonationDays);

  return (
    <Page>
      <PageTitle
        title={donor.name}
        description="Manage your availability and respond to requests sent to you through BloodGrid."
        actions={
          awaiting.length > 0 && (
            <Button variant="primary" to="/donor/requests">
              Review {awaiting.length} {awaiting.length === 1 ? 'request' : 'requests'}
            </Button>
          )
        }
      />

      <Section title="Your donor record" divide={false}>
        <div className="max-w-[420px]">
          <DetailList>
            <Detail label="Blood group">{donor.bloodGroup}</Detail>
            <Detail label="Registered sector">{donor.sector}</Detail>
            <Detail label="Donations completed"><span className="tabular-nums">{donor.completedDonations}</span></Detail>
            <Detail label="Last donation"><span className="tabular-nums">{donor.lastDonationDays} days ago</span></Detail>
            <Detail label="Eligibility">
              {daysUntilEligible === 0
                ? 'Eligible to donate'
                : `Eligible in ${daysUntilEligible} days`}
            </Detail>
          </DetailList>
        </div>
      </Section>

      <Section
        title="Availability"
        description="Donors marked available carry more weight in BloodGrid's ranking."
      >
        <div className="flex items-center justify-between gap-6 max-w-[420px] border border-slate-200 rounded-md px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-slate-900">
              {donorAvailable ? 'Available to donate' : 'Not currently available'}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {donorAvailable
                ? 'You may receive requests from nearby seekers.'
                : 'You will not appear as available in donor recommendations.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={donorAvailable}
            aria-label="Available to donate"
            onClick={() => setDonorAvailable(!donorAvailable)}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              donorAvailable ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                donorAvailable ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </Section>

      <Section
        title="Requests sent to you"
        actions={inbox.length > 0 && <Button size="sm" to="/donor/requests">View all</Button>}
      >
        {inbox.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-slate-600 max-w-[70ch]">
            Nothing has been sent to you yet. Switch to the Seeker workspace, create a request and
            send it to {donor.name}, and it will arrive here. That is the whole loop, inside one
            application.
          </p>
        ) : (
          <ul className="border border-slate-200 rounded-md divide-y divide-slate-100">
            {inbox.map((entry) => (
              <li key={`${entry.requestId}-${entry.donorId}`} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-900">Request {entry.requestId}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">Sent {entry.sentLabel}</p>
                </div>
                <Status tone={entry.state === 'Accepted' ? 'good' : entry.state === 'Declined' ? 'neutral' : 'info'}>
                  {entry.state === 'Sent' ? 'Awaiting your response' : entry.state}
                </Status>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}
