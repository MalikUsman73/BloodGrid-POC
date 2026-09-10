/**
 * The matching step.
 *
 * This screen exists so the matching stage is visible in the workflow rather
 * than happening invisibly between two pages. The engine itself is synchronous
 * and deterministic; the stepped progression is presentation only.
 */

import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../../components/ui';
import { PrototypeNote } from '../../components/PrototypeLabels';
import { useApp } from '../../store/AppStore';
import { MATCHING_STEPS, rankDonorsForRequest } from '../../engines/matching';
import { donors } from '../../mock/donors';

const STEP_INTERVAL_MS = 280;
const COMPLETION_PAUSE_MS = 320;

export default function Matching() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { findRequest } = useApp();
  const request = findRequest(id!);
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    if (!request) return;

    if (completedSteps >= MATCHING_STEPS.length) {
      const timer = setTimeout(
        () => navigate(`/seeker/request/${id}/matches`, { replace: true }),
        COMPLETION_PAUSE_MS,
      );
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setCompletedSteps((step) => step + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [completedSteps, request, id, navigate]);

  if (!request) return <Navigate to="/seeker" replace />;

  const outcome = rankDonorsForRequest(donors, request);

  return (
    <Page>
      <div className="max-w-[440px] mx-auto pt-10">
        <h1 className="text-[15px] font-semibold text-slate-900">
          Matching donors for {request.patientRef}
        </h1>
        <p className="mt-1 text-[12.5px] text-slate-500">
          {request.units} {request.units === 1 ? 'unit' : 'units'} of {request.bloodGroup},
          {' '}{request.urgency}, Sector {request.sector}
        </p>

        <ol className="mt-6 space-y-2.5">
          {MATCHING_STEPS.map((step, index) => {
            const done = index < completedSteps;
            const active = index === completedSteps;
            return (
              <li key={step} className="flex items-baseline gap-3 text-[13px]">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 translate-y-[-1px] ${
                    done ? 'bg-emerald-500' : active ? 'bg-crimson-700' : 'bg-slate-300'
                  }`}
                />
                <span className={done ? 'text-slate-500' : active ? 'text-slate-900' : 'text-slate-400'}>
                  {step}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 text-[12px] text-slate-500 tabular-nums">
          {outcome.poolSize} donors screened. {outcome.incompatibleCount} incompatible,
          {' '}{outcome.withinIntervalCount} within the donation interval.
        </p>

        <div className="mt-6">
          <PrototypeNote ccp={1} />
        </div>
      </div>
    </Page>
  );
}
