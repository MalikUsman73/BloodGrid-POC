/**
 * Prototype status wording.
 *
 * Every screen that shows output from either computational component uses one
 * of these, so the wording that separates this prototype from the committed
 * implementation work is written once and reads the same everywhere.
 */

export const CCP1_CURRENT = 'Prototype Match Score, simulated matching output';
export const CCP1_FUTURE =
  'Future implementation: NSGA-III multi-objective optimisation';
export const CCP2_CURRENT = 'Prototype forecast, simulated for proposal-stage demonstration';
export const CCP2_FUTURE = 'Future implementation: trained forecasting model';

/** A single line placed near a computational output. */
export function PrototypeNote({ ccp }: { ccp: 1 | 2 }) {
  const current = ccp === 1 ? CCP1_CURRENT : CCP2_CURRENT;
  const future = ccp === 1 ? CCP1_FUTURE : CCP2_FUTURE;
  return (
    <p className="text-[12px] leading-[1.6] text-slate-600 border-l-2 border-amber-400 pl-3">
      <span className="font-medium text-slate-800">{current}.</span>{' '}
      {future}.
    </p>
  );
}

/** A compact marker for section headings and table captions. */
export function SimulatedMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-px text-[10.5px] font-medium uppercase tracking-wide text-amber-900 ${className}`}
    >
      Simulated
    </span>
  );
}

/** A footnote for illustrative values and simulated scenario inputs. */
export function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] leading-[1.6] text-slate-500">{children}</p>;
}
