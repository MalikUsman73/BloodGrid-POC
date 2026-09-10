/**
 * Donor detail.
 *
 * The screen exists to help a seeker decide whether to send this donor a
 * request, so it shows what the ranking was based on and one clear action.
 *
 * BloodGrid never shows a donor's personal contact details. A request is sent
 * through the application, and a conversation opens only once the donor
 * accepts.
 */

import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  BloodGroup as BloodGroupTag, Button, Detail, DetailList, Notice,
  Page, PageTitle, Section, Status, StatusDot,
} from '../../components/ui';
import { Footnote, PrototypeNote, SimulatedMark } from '../../components/PrototypeLabels';
import { CriteriaDetail } from '../../components/CriteriaBars';
import { useApp } from '../../store/AppStore';
import { rankDonorsForRequest } from '../../engines/matching';
import { donors } from '../../mock/donors';
import { availabilityTone, tierTone } from '../../lib/status';

export default function DonorDetail() {
  const { id, donorId } = useParams();
  const navigate = useNavigate();
  const { findRequest, findDonorRequest, sendRequestToDonor } = useApp();
  const request = findRequest(id!);

  const outcome = useMemo(
    () => (request ? rankDonorsForRequest(donors, request) : null),
    [request],
  );

  if (!request || !outcome) return <Navigate to="/seeker" replace />;

  const match = outcome.results.find((result) => result.donor.id === donorId);
  if (!match) return <Navigate to={`/seeker/request/${request.id}/matches`} replace />;

  const donor = match.donor;
  const sent = findDonorRequest(request.id, donor.id);

  function sendDonorRequest() {
    sendRequestToDonor(request!.id, donor.id);
    navigate(`/seeker/request/${request!.id}/sent/${donor.id}`);
  }

  return (
    <Page>
      <PageTitle
        title={donor.name}
        description={`Ranked ${match.rank} of ${outcome.results.length} for ${request.patientRef}, ${request.units} ${request.units === 1 ? 'unit' : 'units'} of ${request.bloodGroup}.`}
        back={{ to: `/seeker/request/${request.id}/matches`, label: 'Back to suitable donors' }}
        actions={<Status tone={tierTone(match.tier)}>{match.tier} match</Status>}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-x-10 gap-y-8 items-start">
        <div>
          <Section>
            <div className="flex items-center gap-4">
              <BloodGroupTag group={donor.bloodGroup} size="lg" />
              <div>
                <p className="text-[13px] text-slate-600">
                  {donor.id}, age {donor.age}, {donor.completedDonations} previous donations
                </p>
                <div className="mt-1">
                  <StatusDot tone={availabilityTone(donor.availability)}>{donor.availability}</StatusDot>
                </div>
              </div>
              <div className="ml-auto text-right">
                <span className="block text-[26px] font-semibold text-slate-900 tabular-nums leading-none">
                  {match.score}
                </span>
                <span className="block mt-1 text-[11px] text-slate-500">Prototype Match Score</span>
              </div>
            </div>

            <div className="mt-5 max-w-[420px]">
              <DetailList>
                <Detail label="Location">Sector {donor.sector}</Detail>
                <Detail label="Distance from request"><span className="tabular-nums">{donor.distanceKm} km</span></Detail>
                <Detail label="Last donation"><span className="tabular-nums">{donor.lastDonationDays} days ago</span></Detail>
                <Detail label="Eligibility">{donor.eligible ? 'Eligible to donate' : 'Within donation interval'}</Detail>
                <Detail label="Record">{donor.verified ? 'Verified' : 'Unverified'}</Detail>
              </DetailList>
            </div>
          </Section>

          <Section
            title="What this ranking is based on"
            description="These five criteria are the objectives the future NSGA-II implementation will optimise over."
            actions={<SimulatedMark />}
          >
            <div className="max-w-[460px]">
              <CriteriaDetail objectives={match.objectives} />
            </div>
            <div className="mt-5 max-w-[560px]">
              <PrototypeNote ccp={1} />
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-[76px] border border-slate-200 rounded-lg shadow-surface p-5">
          <h2 className="text-[13px] font-semibold text-slate-900">Contact this donor</h2>

          {!sent && (
            <>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-600">
                BloodGrid sends the request on your behalf. If {donor.name.split(' ')[0]} accepts,
                a conversation opens here so you can arrange the donation.
              </p>
              <Button variant="primary" block className="mt-4" onClick={sendDonorRequest}>
                Send request
              </Button>
              <p className="mt-3 text-[11.5px] leading-[1.6] text-slate-500">
                Donor contact details stay private. Messaging becomes available after the donor
                accepts.
              </p>
            </>
          )}

          {sent?.state === 'Sent' && (
            <div className="mt-3 space-y-3">
              <Notice tone="info" title="Request sent">
                Sent on {sent.sentLabel}. Waiting for {donor.name.split(' ')[0]} to respond.
              </Notice>
              <p className="text-[12px] leading-[1.6] text-slate-500">
                Messaging becomes available once the donor accepts.
              </p>
            </div>
          )}

          {sent?.state === 'Accepted' && (
            <div className="mt-3 space-y-3">
              <Notice tone="good" title="Request accepted">
                {donor.name.split(' ')[0]} accepted this request. You can now arrange the donation
                inside BloodGrid.
              </Notice>
              <Button
                variant="primary" block
                to={`/seeker/request/${request.id}/conversation/${donor.id}`}
              >
                Open conversation
              </Button>
            </div>
          )}

          {sent?.state === 'Declined' && (
            <div className="mt-3 space-y-3">
              <Notice tone="neutral" title="Request declined">
                {donor.name.split(' ')[0]} is unable to donate for this request.
              </Notice>
              <Button block to={`/seeker/request/${request.id}/matches`}>
                Review other donors
              </Button>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <Footnote>
              This prototype does not deliver notifications or messages outside the application.
              Real delivery is implementation-phase work.
            </Footnote>
          </div>
        </aside>
      </div>
    </Page>
  );
}
