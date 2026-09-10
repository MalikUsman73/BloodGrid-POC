/**
 * Ranked donor recommendations, the main output of CCP 1.
 *
 * The screen exists so a seeker can compare suitable donors and choose one, so
 * the ranked list and the map are the only two things on it.
 *
 * The combined figure is a Prototype Match Score. It is never described as an
 * NSGA-II result, a Pareto-optimal solution, or a non-dominated solution.
 */

import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  BloodGroup as BloodGroupTag, Button, EmptyState, Page, PageTitle,
  Section, Status, StatusDot,
} from '../../components/ui';
import { PrototypeNote, SimulatedMark } from '../../components/PrototypeLabels';
import { CriteriaBars, CriteriaLegend } from '../../components/CriteriaBars';
import DonorMap from '../../components/map/DonorMap';
import { useApp } from '../../store/AppStore';
import { CRITERIA, CRITERION_WEIGHTS, rankDonorsForRequest } from '../../engines/matching';
import { donors } from '../../mock/donors';
import { availabilityTone, tierTone, urgencyTone } from '../../lib/status';

export default function MatchResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { findRequest, findDonorRequest } = useApp();
  const request = findRequest(id!);

  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);
  const [hoveredDonorId, setHoveredDonorId] = useState<string | null>(null);

  const outcome = useMemo(
    () => (request ? rankDonorsForRequest(donors, request) : null),
    [request],
  );

  if (!request || !outcome) return <Navigate to="/seeker" replace />;

  const { results } = outcome;
  const selected = results.find((result) => result.donor.id === selectedDonorId) ?? results[0];
  const weights = CRITERION_WEIGHTS[request.urgency];

  return (
    <Page>
      <PageTitle
        title="Suitable donors"
        description={
          <>
            {results.length} {results.length === 1 ? 'donor' : 'donors'} match this request from a
            pool of {outcome.poolSize}. {outcome.incompatibleCount} were removed for an
            incompatible blood group and {outcome.withinIntervalCount} for being within the
            90-day donation interval.
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

      {results.length === 0 ? (
        <EmptyState
          title="No suitable donors in the simulated pool"
          message="No donor is both compatible with this blood group and outside the minimum donation interval. Try another blood group to see the matching engine produce results."
          action={<Button variant="primary" size="sm" to="/seeker/request/new">Create another request</Button>}
        />
      ) : (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_460px] gap-x-8 gap-y-8 items-start">
          <Section
            title="Ranked by Prototype Match Score"
            description={`Weighting adapts to urgency. For ${request.urgency.toLowerCase()} requests: ${CRITERIA.map((criterion) => `${criterion.label.toLowerCase()} ${Math.round(weights[criterion.key] * 100)} percent`).join(', ')}.`}
            actions={<SimulatedMark />}
            divide={false}
          >
            <div className="flex items-end gap-4 px-4 pb-2">
              <span className="w-5 shrink-0" />
              <div className="flex-1 max-w-[400px]">
                <CriteriaLegend />
              </div>
              <span className="w-[34px] shrink-0" />
            </div>

            <ul className="border border-slate-200 rounded-md divide-y divide-slate-100">
              {results.map((result) => {
                const donor = result.donor;
                const isSelected = donor.id === selected?.donor.id;
                const sent = findDonorRequest(request.id, donor.id);
                return (
                  <li key={donor.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDonorId(donor.id)}
                      onPointerEnter={() => setHoveredDonorId(donor.id)}
                      onPointerLeave={() => setHoveredDonorId(null)}
                      className={`w-full text-left px-4 py-3.5 transition-colors ${
                        isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span className="w-5 pt-0.5 text-[12.5px] font-medium text-slate-400 tabular-nums shrink-0">
                          {result.rank}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="text-[13.5px] font-medium text-slate-900">{donor.name}</span>
                            <BloodGroupTag group={donor.bloodGroup} size="sm" />
                            <Status tone={tierTone(result.tier)}>{result.tier}</Status>
                            {sent && (
                              <Status tone={sent.state === 'Accepted' ? 'good' : 'info'}>
                                {sent.state === 'Accepted' ? 'Accepted' : 'Request sent'}
                              </Status>
                            )}
                          </div>

                          <p className="mt-1 text-[12.5px] text-slate-500">
                            Sector {donor.sector}, {donor.distanceKm} km. Last donated{' '}
                            {donor.lastDonationDays} days ago.
                          </p>

                          <div className="mt-1.5">
                            <StatusDot tone={availabilityTone(donor.availability)}>
                              {donor.availability}
                            </StatusDot>
                          </div>

                          <div className="mt-3 max-w-[400px]">
                            <CriteriaBars objectives={result.objectives} />
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="block text-[17px] font-semibold text-slate-900 tabular-nums leading-none">
                            {result.score}
                          </span>
                          <span className="block mt-1 text-[10.5px] text-slate-400">score</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4">
              <PrototypeNote ccp={1} />
            </div>
          </Section>

          <div className="xl:sticky xl:top-[76px] space-y-5">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900 mb-1">Donor locations</h2>
              <p className="text-[12.5px] text-slate-600 mb-3">
                Approximate sector-level positions relative to the request in Sector {request.sector}.
              </p>
              <DonorMap
                results={results}
                selectedDonorId={selected?.donor.id ?? null}
                hoveredDonorId={hoveredDonorId}
                onSelect={setSelectedDonorId}
                onHover={setHoveredDonorId}
                className="h-[340px]"
              />
            </div>

            {selected && (
              <div className="border border-slate-200 rounded-md p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-slate-900">{selected.donor.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-slate-500">
                      Rank {selected.rank} of {results.length}, Sector {selected.donor.sector},
                      {' '}{selected.donor.distanceKm} km
                    </p>
                  </div>
                  <BloodGroupTag group={selected.donor.bloodGroup} />
                </div>
                <Button
                  variant="primary" block className="mt-4"
                  onClick={() => navigate(`/seeker/request/${request.id}/donor/${selected.donor.id}`)}
                >
                  View donor
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
