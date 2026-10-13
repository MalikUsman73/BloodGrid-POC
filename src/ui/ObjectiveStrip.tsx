import type { ObjectiveValues } from '../engine';
import { OBJECTIVES } from '../lib/labels';

export function ObjectiveStrip({ values }: { values: ObjectiveValues }) {
  return (
    <div className="objectives">
      {OBJECTIVES.map((o) => (
        <div className="objective" key={o.key}>
          <div className="code">{o.code}</div>
          <div className="v num">{o.format(values[o.key])}</div>
          <div className="l">{o.label}</div>
          <div className="g">{o.goal}</div>
        </div>
      ))}
    </div>
  );
}
