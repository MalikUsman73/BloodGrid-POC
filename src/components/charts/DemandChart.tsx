/**
 * Recorded demand and prototype forecast on one axis.
 *
 * The forward series is dashed and separated by a marked boundary, so the line
 * between recorded history and prototype forecast is unmistakable. The shaded
 * band is an illustrative range, not a fitted prediction interval, and no
 * accuracy or error measure is computed or displayed.
 */

import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DemandSeries } from '../../types';
import { buildChartRows, elevatedWindow } from '../../engines/forecast';

/** ResponsiveContainer collapses inside an unconstrained parent, so height is explicit. */
export const CHART_HEIGHT = 300;

const AXIS_STYLE = { fontSize: 11, fill: '#94a3b8' };

interface Props {
  series: DemandSeries;
  height?: number;
  /** Trailing history days to show, keeping the view legible on a projector. */
  historyWindow?: number;
}

export default function DemandChart({ series, height = CHART_HEIGHT, historyWindow = 45 }: Props) {
  const rows = buildChartRows(series).slice(
    Math.max(0, series.history.length - historyWindow),
  );
  const boundaryLabel = series.history[series.history.length - 1].label;
  const elevated = elevatedWindow(series);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: -14 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="label" tick={AXIS_STYLE} tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" minTickGap={30}
          />
          <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={44} />

          {elevated && (
            <ReferenceArea
              x1={elevated.from} x2={elevated.to}
              fill="#f59e0b" fillOpacity={0.09} stroke="none"
            />
          )}

          <ReferenceLine
            x={boundaryLabel} stroke="#94a3b8" strokeDasharray="3 3"
            label={{ value: 'Forecast from here', position: 'insideTopRight', fontSize: 10, fill: '#64748b', offset: 8 }}
          />

          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
            formatter={(value: unknown, name: string) => {
              if (value === null || value === undefined) return [null, null] as never;
              if (name === 'band') {
                const [low, high] = value as [number, number];
                return [`${low} to ${high} units`, 'Illustrative range'];
              }
              return [
                `${value} units`,
                name === 'recorded' ? 'Recorded (simulated)' : 'Prototype forecast',
              ];
            }}
          />

          {/* Range area, filled only between bounds rather than down to the axis. */}
          <Area
            dataKey="band" name="band" stroke="none" fill="#f59e0b" fillOpacity={0.16}
            isAnimationActive={false} connectNulls
          />
          <Line
            dataKey="recorded" name="recorded" stroke="#98283a" strokeWidth={1.75}
            dot={false} isAnimationActive={false} connectNulls={false}
          />
          <Line
            dataKey="projected" name="projected" stroke="#b45309" strokeWidth={1.75}
            strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legend drawn in plain markup, which is lighter than the charting library's own. */
export function DemandChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-slate-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-4 h-px bg-crimson-700" />Recorded demand (simulated)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-4 border-t border-dashed border-amber-700" />Prototype forecast
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-4 h-2 bg-amber-500/20" />Illustrative range
      </span>
    </div>
  );
}
