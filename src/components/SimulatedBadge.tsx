/**
 * PROTOTYPE STATUS LABELLING.
 *
 * Every screen that renders output from either computational component MUST
 * mount one of these. They are the single source of the wording used to
 * distinguish what this proposal-stage POC actually does from what the FYP
 * implementation phase will build.
 *
 * The wording here is deliberate and must not be softened:
 *   - CCP 1 output is a "Prototype Match Score", never an NSGA-II result.
 *   - CCP 2 output is a "Prototype Forecast", never a model prediction.
 *   - No accuracy, error metric, or confidence figure appears anywhere.
 */

import { FlaskConical, Info } from 'lucide-react';

export const CCP1_CURRENT = 'Prototype Match Score — Simulated Matching Output';
export const CCP1_FUTURE = 'Future Implementation: NSGA-II Multi-Objective Optimization';
export const CCP2_CURRENT = 'Prototype Forecast — Simulated for Proposal-Stage Demonstration';
export const CCP2_FUTURE = 'Future Implementation: Trained Forecasting Model';

/** Full-width notice placed directly above or below a computational output. */
export function SimulatedNotice({ ccp, className = '' }: { ccp: 1 | 2; className?: string }) {
  const current = ccp === 1 ? CCP1_CURRENT : CCP2_CURRENT;
  const future = ccp === 1 ? CCP1_FUTURE : CCP2_FUTURE;
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}>
      <FlaskConical className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-amber-900 leading-5">{current}</p>
        <p className="text-xs text-amber-800/90 leading-5 mt-0.5">{future}</p>
      </div>
    </div>
  );
}

/** Compact inline marker for cards, table headers, and chart corners. */
export function SimulatedTag({ ccp, className = '' }: { ccp?: 1 | 2; className?: string }) {
  return (
    <span
      title={
        ccp === 1 ? `${CCP1_CURRENT}. ${CCP1_FUTURE}.`
        : ccp === 2 ? `${CCP2_CURRENT}. ${CCP2_FUTURE}.`
        : 'Simulated demonstration data.'
      }
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 ${className}`}
    >
      <FlaskConical className="w-3 h-3" />
      Simulated
    </span>
  );
}

/** Explanatory footnote for illustrative scenario factors and ranges. */
export function IllustrativeNote({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed ${className}`}>
      <Info className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
      <span>{children}</span>
    </p>
  );
}
