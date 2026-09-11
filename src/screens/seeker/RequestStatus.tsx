/**
 * Request status, the main CCP 1 output screen.
 *
 * BloodGrid selects the donors and notifies them; the seeker does not pick.
 * Until a donor accepts, the selected donors are shown anonymously: blood
 * group, sector, distance and the criteria that put them on the list, but no
 * name. A donor who accepts is revealed by name and a conversation opens.
 *
 * The combined figure is a Prototype Match Score. It is never described as an
 * NSGA-II result, a Pareto-optimal solution, or a non-dominated solution.
 */

import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { DonorRequest, MatchResult } from '../../types';
import {
  BloodGroup as BloodGroupTag, Button, EmptyState, Notice, Page, PageTitle,
  Status, StatusDot, Surface, SurfaceHeader,
} from '../../components/ui';
import { PrototypeNote, SimulatedMark } from '../../components/PrototypeLabels';
import { CriteriaBars, CriteriaLegend } from '../../components/CriteriaBars';
import DonorMap from '../../components/map/DonorMap';
import { useApp } from '../../store/AppStore';
import { CRITERIA, CRITERION_WEIGHTS } from '../../engines/matching';
import { availabilityLabel, availabilityTone, tierTone, urgencyTone } from '../../lib/status';
import { pluralUnits } from '../../lib/format';

/** Anonymous labels, assigned in rank order: Donor A, Donor B, and so on. */
function anonymousLabel(index: number): string {
  return `Donor ${String.fromCharCode(65 + index)}`;
}

export default function RequestStatus() {
  const { id } = useParams();
  const { findRequest, donorRequestsFor, findDonor } = useApp();
  const request = findRequest(id!);

  const [hoveredDonorId, setHoveredDonorId] = useState<string | null>(null);

  if (!request) return <Navigate to="/seeker" replace />;

  const notified = donorRequestsFor(request.id);
  const accepted = notified.filter((entry) => entry.state === 'Accepted');
  const declined = notified.filter((entry) => entry.state === 'Declined');
  const waiting = notified.filter((entry) => entry.state === 'Sent');

  /**
   * Built from the stored notification records, not by re-ranking. A donor's
   * record changes once they accept, so recomputing would alter the reasoning
   * shown and would drop the accepted donor from the list entirely.
   */
  const shown: { result: MatchResult; link: DonorRequest }[] = [...notified]
    .sort((a, b) => a.rank - b.rank)
    .map((link) => {
      const donor = findDonor(link.donorId);
      if (!donor) return null;
      return {
        link,
        result: {
          donor,
          objectives: link.objectives,
          score: link.score,
          tier: link.tier,
          rank: link.rank,
        } satisfies MatchResult,
      };
    })
    .filter((entry): entry is { result: MatchResult; link: DonorRequest } => entry !== null);

  const weights = CRITERION_WEIGHTS[request.urgency];
  const stillNeeded = Math.max(0, request.units - accepted.length);

  return (
    <Page>
      <PageTitle
        title="Request status"
        description={
          <>
            {request.patientRef}, {pluralUnits(request.units)} of {request.bloodGroup}.
            BloodGrid notified {notified.length} donors, selected automatically by the matching
            engine.
          </>
        }
        back={{ to: '/seeker', label: 'Back to blood requests' }}
        actions={
          <div className="flex items-center gap-2">
            <BloodGroupTag group={request.bloodGroup} />
            <Status tone={urgencyTone(request.urgency)}>{request.urgency}</Status>
          </div>
        }
      />

      <div className="mb-5">
        {accepted.length === 0 ? (
          <Notice tone="info" title={`Awaiting response from ${waiting.length} ${waiting.length === 1 ? 'donor' : 'donors'}`}>
            BloodGrid has notified the selected donors on your behalf. Their names become visible
            as soon as one accepts, and a conversation opens at that point.
            {declined.length > 0 && ` ${declined.length} have declined so far.`}
          </Notice>
        ) : stillNeeded > 0 ? (
          <Notice tone="good" title={`${accepted.length} of ${request.units} donors confirmed`}>
            You can message the confirmed donors now. BloodGrid is still waiting on{' '}
            {waiting.length} {waiting.length === 1 ? 'response' : 'responses'} for the remaining{' '}
            {pluralUnits(stillNeeded)}.
          </Notice>
        ) : (
          <Notice tone="good" title="Your request has been accepted">
            {accepted.length} {accepted.length === 1 ? 'donor has' : 'donors have'} accepted and
            your request is covered. Any remaining donors have been stood down.
          </Notice>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="No suitable donors in the simulated pool"
          message="No donor is both compatible with this blood group and outside the minimum donation interval."
          action={<Button variant="primary" size="sm" to="/seeker/request/new">Create another request</Button>}
        />
      ) : (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_460px] gap-x-8 gap-y-8 items-start">
          <Surface>
            <SurfaceHeader
              title="Donors notified"
              description={`Selected by Prototype Match Score. Weighting adapts to urgency; for ${request.urgency.toLowerCase()} requests: ${CRITERIA.map((criterion) => `${criterion.label.toLowerCase()} ${Math.round(weights[criterion.key] * 100)} percent`).join(', ')}.`}
              actions={<SimulatedMark />}
            />

            <div className="flex items-end gap-4 px-4 pt-3 pb-2 bg-slate-50/70 border-b border-slate-200">
              <span className="w-[86px] shrink-0" />
              <div className="flex-1 max-w-[340px]"><CriteriaLegend /></div>
              <span className="w-[34px] shrink-0" />
            </div>

            <ul className="divide-y divide-slate-100">
              {shown.map(({ result, link }, index) => {
                const donor = result.donor;
                const revealed = link.state === 'Accepted';
                const identity = revealed ? donor.name : anonymousLabel(index);

                return (
                  <li
                    key={donor.id}
                    onPointerEnter={() => setHoveredDonorId(donor.id)}
                    onPointerLeave={() => setHoveredDonorId(null)}
                    className="px-4 py-3.5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="w-[86px] shrink-0 pt-0.5">
                        <span className={`text-[13px] font-medium ${revealed ? 'text-slate-900' : 'text-slate-500'}`}>
                          {identity}
                        </span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <BloodGroupTag group={donor.bloodGroup} size="sm" />
                          <Status tone={tierTone(result.tier)}>{result.tier}</Status>
                          {link.state === 'Sent' && <Status tone="info">Notified</Status>}
                          {link.state === 'Accepted' && <Status tone="good">Accepted</Status>}
                          {link.state === 'Declined' && <Status tone="neutral">Declined</Status>}
                          {link.state === 'Stood Down' && <Status tone="neutral">Stood down</Status>}
                        </div>

                        <p className="mt-1 text-[12.5px] text-slate-500">
                          Sector {donor.sector}, {donor.distanceKm} km. Last donated{' '}
                          {donor.lastDonationDays} days ago.
                        </p>

                        <div className="mt-1.5">
                          <StatusDot tone={availabilityTone(donor.available)}>
                            {availabilityLabel(donor.available)}
                          </StatusDot>
                        </div>

                        <div className="mt-3 max-w-[340px]">
                          <CriteriaBars objectives={result.objectives} />
                        </div>

                        {revealed && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              to={`/seeker/request/${request.id}/conversation/${donor.id}`}
                            >
                              Open conversation
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="block text-[17px] font-semibold text-slate-900 tabular-nums leading-none">
                          {result.score}
                        </span>
                        <span className="block mt-1 text-[10.5px] text-slate-400">score</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/50">
              <PrototypeNote ccp={1} />
            </div>
          </Surface>

          <div className="xl:sticky xl:top-[76px]">
            <Surface>
              <SurfaceHeader
                title="Donor locations"
                description={`Approximate sector-level positions relative to Sector ${request.sector}. Names are withheld until a donor accepts.`}
              />
              <DonorMap
                results={shown.map((entry) => entry.result)}
                hoveredDonorId={hoveredDonorId}
                onHover={setHoveredDonorId}
                anonymousNames={Object.fromEntries(
                  shown.map(({ result, link }, index) => [
                    result.donor.id,
                    link.state === 'Accepted' ? result.donor.name : anonymousLabel(index),
                  ]),
                )}
                className="h-[340px] border-0 rounded-none"
              />
            </Surface>
          </div>
        </div>
      )}
    </Page>
  );
}
