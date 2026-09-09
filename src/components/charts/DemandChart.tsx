/**
 * CCP 2 demand visualisation — historical series plus PROTOTYPE FORECAST.
 *
 * The forward series is drawn dashed and separated by a "Today" divider so the
 * boundary between recorded (simulated) history and prototype forecast is
 * unmistakable. The shaded band is an ILLUSTRATIVE RANGE only; it is not a
 * fitted prediction interval and is captioned as such wherever it appears.
 *
 * No accuracy, error metric, or confidence figure is computed or displayed.
 */

import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DemandSeries } from '../../types';
import { chartRows } from '../../engines/forecast';

/** Every chart wrapper carries an explicit height — ResponsiveContainer
 *  collapses to zero inside an unconstrained flex parent. */
export const CHART_HEIGHT = 340;

interface Props {
  series: DemandSeries;
  height?: number;
  /** Show only the trailing N history days, to keep the projector view legible. */
  historyWindow?: number;
}

export default function DemandChart({ series, height = CHART_HEIGHT, historyWindow = 45 }: Props) {
  const all = chartRows(series);
  const start = Math.max(0, series.history.length - historyWindow);
  const rows = all.slice(start);

  const todayLabel = series.history[series.history.length - 1].label;

  // Highlight the elevated window inside the forward series.
  const peakIdx = series.forecast.findIndex((f) => f.projected === series.peakProjected);
  const highFrom = series.highDemand ? series.forecast[Math.max(0, peakIdx - 3)]?.label : null;
  const highTo = series.highDemand ? series.forecast[Math.min(series.forecast.length - 1, peakIdx + 3)]?.label : null;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 16, bottom: 8, left: -12 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
            width={48} label={undefined}
          />

          {highFrom && highTo && (
            <ReferenceArea
              x1={highFrom} x2={highTo} fill="#f59e0b" fillOpacity={0.1}
              stroke="#f59e0b" strokeOpacity={0.25}
              label={{ value: 'Elevated demand', position: 'insideTop', fontSize: 10, fill: '#b45309' }}
            />
          )}

          <ReferenceLine
            x={todayLabel} stroke="#64748b" strokeDasharray="4 3"
            label={{ value: 'Today', position: 'insideTopRight', fontSize: 10, fill: '#475569', offset: 8 }}
          />

          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            contentStyle={{
              fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px -2px rgb(15 23 42 / 0.12)',
            }}
            formatter={(value: any, name: string) => {
              if (value === null || value === undefined) return [null, null] as any;
              if (name === 'band') {
                const [lo, hi] = value as [number, number];
                return [`${lo}–${hi} units`, 'Illustrative range'];
              }
              const label =
                name === 'actual' ? 'Recorded (simulated)'
                : name === 'projected' ? 'Prototype forecast'
                : name;
              return [`${value} units`, label];
            }}
          />

          <Legend
            verticalAlign="top" height={30} iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: '#64748b' }}
            formatter={(value) =>
              value === 'actual' ? 'Recorded demand (simulated)'
              : value === 'projected' ? 'Prototype forecast'
              : value === 'band' ? 'Illustrative range'
              : null
            }
          />

          {/* Illustrative range — a true range area, filled only between
              the lower and upper bound rather than down to the axis. */}
          <Area
            dataKey="band" stroke="none" fill="#f59e0b" fillOpacity={0.16}
            isAnimationActive={false} connectNulls legendType="rect" name="band"
          />

          <Line
            dataKey="actual" stroke="#cf2544" strokeWidth={2} dot={false}
            isAnimationActive={false} connectNulls={false} name="actual"
          />
          <Line
            dataKey="projected" stroke="#b45309" strokeWidth={2} strokeDasharray="5 4"
            dot={false} isAnimationActive={false} connectNulls={false} name="projected"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Compact sparkline used on inventory tiles. */
export function DemandSparkline({ series, height = 40 }: { series: DemandSeries; height?: number }) {
  const rows = series.history.slice(-30).map((h) => ({ label: h.label, units: h.units }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Line dataKey="units" stroke="#cf2544" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
