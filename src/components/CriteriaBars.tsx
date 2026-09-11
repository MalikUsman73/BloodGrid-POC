/**
 * The five criteria behind a Prototype Match Score.
 *
 * Shown in both the ranked list and the donor detail screen, which is why it
 * lives here rather than in either one.
 */

import type { ObjectiveVector } from '../types';
import { CRITERIA } from '../engines/matching';
import { Bar } from './ui';

/**
 * Bars only. The labels are printed once in `CriteriaLegend` above the list
 * rather than repeated on every row, which is where the noise came from.
 */
export function CriteriaBars({ objectives }: { objectives: ObjectiveVector }) {
  return (
    <div className="grid grid-cols-4 gap-x-3">
      {CRITERIA.map((criterion) => (
        <Bar
          key={criterion.key}
          value={objectives[criterion.key]}
          tone="info"
        />
      ))}
    </div>
  );
}

/** Printed once, directly above a list of ranked donors. */
export function CriteriaLegend() {
  return (
    <div className="grid grid-cols-4 gap-x-3">
      {CRITERIA.map((criterion) => (
        <p
          key={criterion.key}
          title={criterion.description}
          className="text-[10.5px] leading-tight text-slate-500"
        >
          {criterion.label}
        </p>
      ))}
    </div>
  );
}

export function CriteriaDetail({ objectives }: { objectives: ObjectiveVector }) {
  return (
    <dl className="space-y-3.5">
      {CRITERIA.map((criterion) => (
        <div key={criterion.key}>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[12.5px] font-medium text-slate-800">{criterion.label}</dt>
            <dd className="text-[12.5px] text-slate-500 tabular-nums">
              {Math.round(objectives[criterion.key] * 100)}
            </dd>
          </div>
          <Bar value={objectives[criterion.key]} tone="info" className="mt-1.5" />
          <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{criterion.description}</p>
        </div>
      ))}
    </dl>
  );
}
