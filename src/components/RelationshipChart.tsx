import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Pair } from '../../shared/relationships';
import { useReveal, useReducedMotion } from '../lib/motion';
export function RelationshipChart({
  pairs,
  xLabel,
  yLabel,
}: {
  pairs: Pair[];
  xLabel: string;
  yLabel: string;
}) {
  const reveal = useReveal<HTMLDivElement>('chart', JSON.stringify([pairs, xLabel, yLabel]));
  const reduced = useReducedMotion();
  return (
    <div
      ref={reveal}
      className="chart"
      role="img"
      aria-label={`${xLabel} against ${yLabel}; each point is an aligned pair of days.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 15, right: 25, bottom: 25, left: 15 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis
            dataKey="x"
            name={xLabel}
            type="number"
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            label={{
              value: xLabel,
              position: 'insideBottom',
              offset: -15,
              fill: 'var(--muted)',
              fontSize: 11,
            }}
          />
          <YAxis
            dataKey="y"
            name={yLabel}
            type="number"
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
          />
          <Tooltip
            isAnimationActive={!reduced}
            animationDuration={120}
            animationEasing="ease-out"
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Pair | undefined;
              return active && p ? (
                <div className="chart-tooltip">
                  <strong>
                    {p.predictorDate} → {p.date}
                  </strong>
                  <p>
                    {xLabel}: {p.x.toFixed(2)}
                  </p>
                  <p>
                    {yLabel}: {p.y.toFixed(2)}
                  </p>
                </div>
              ) : null;
            }}
          />
          <Scatter
            className="chart-series chart-points"
            data={pairs}
            fill="var(--chart-mean)"
            fillOpacity={0.65}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
