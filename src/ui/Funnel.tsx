import type { FilterStage } from '../engine';

/** The hard filters in order, with how many donors each one removed. */
export function Funnel({ stages, poolSize }: { stages: FilterStage[]; poolSize: number }) {
  return (
    <div className="funnel">
      {stages.map((s) => (
        <div className="funnel-row" key={s.id}>
          <div className="name">{s.label}</div>
          <div className="count num">
            <b>{s.remaining}</b>
            <span>{s.removed > 0 ? `−${s.removed}` : '—'}</span>
          </div>
          <div className="rule">{s.rule}</div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${poolSize === 0 ? 0 : (s.remaining / poolSize) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
