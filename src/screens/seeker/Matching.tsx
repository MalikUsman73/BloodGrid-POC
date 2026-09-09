/**
 * Matching processing state.
 *
 * This screen exists to make CCP 1 visible as a distinct step in the workflow.
 * The staged progression is a PRESENTATION DEVICE — the underlying prototype
 * engine is synchronous and deterministic. No computation is deferred or
 * hidden behind this screen.
 */

import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { PageBody } from '../../components/layout/AppShell';
import { Card, GroupChip } from '../../components/ui';
import { SimulatedNotice } from '../../components/SimulatedBadge';
import { useApp } from '../../store/AppStore';
import { MATCHING_STAGES, runMatching } from '../../engines/matching';
import { donors } from '../../mock/donors';

const STAGE_MS = 280;

export default function Matching() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getRequest } = useApp();
  const request = getRequest(id!);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!request) return;
    if (stage >= MATCHING_STAGES.length) {
      const t = setTimeout(() => navigate(`/seeker/request/${id}/matches`, { replace: true }), 320);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStage((s) => s + 1), STAGE_MS);
    return () => clearTimeout(t);
  }, [stage, request, id, navigate]);

  if (!request) return <Navigate to="/seeker" replace />;

  const outcome = runMatching(donors, {
    bloodGroup: request.bloodGroup,
    urgency: request.urgency,
  });

  return (
    <PageBody>
      <div className="max-w-xl mx-auto pt-6 sm:pt-12">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <GroupChip group={request.bloodGroup} size="lg" />
            <div>
              <h1 className="text-base font-semibold text-slate-900">Matching donors</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {request.units} unit{request.units > 1 ? 's' : ''} · {request.urgency} · Sector {request.sector}
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {MATCHING_STAGES.map((label, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 shrink-0 grid place-items-center rounded-full border transition-colors ${
                      done ? 'bg-emerald-500 border-emerald-500'
                      : active ? 'border-crimson-500 bg-crimson-50'
                      : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {done ? (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    ) : active ? (
                      <Loader2 className="w-3 h-3 text-crimson-600 animate-spin" />
                    ) : null}
                  </span>
                  <span
                    className={`text-sm transition-colors ${
                      done ? 'text-slate-500' : active ? 'text-slate-900 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-crimson-500 transition-[width] duration-300"
              style={{ width: `${(stage / MATCHING_STAGES.length) * 100}%` }}
            />
          </div>

          <p className="mt-3 text-xs text-slate-500 nums">
            Screened {outcome.poolSize} registered donors ·{' '}
            {outcome.incompatibleCount} incompatible ·{' '}
            {outcome.ineligibleCount} within donation interval
          </p>
        </Card>

        <SimulatedNotice ccp={1} className="mt-4" />
      </div>
    </PageBody>
  );
}
