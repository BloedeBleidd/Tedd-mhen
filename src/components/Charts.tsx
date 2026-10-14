import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Prediction } from '../../shared/bayes';
import { prettyDate } from './ui';
export function TrendChart({
  data,
  forecastStart,
  unit,
  simple = false,
}: {
  data: Prediction[];
  forecastStart?: string;
  unit: string;
  simple?: boolean;
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Time series in ${unit}. ${simple ? 'Recorded values.' : 'Observed values, posterior mean, 95% credible interval, and 95% predictive interval.'}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 18, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => prettyDate(value)}
            tickLine={false}
            axisLine={false}
            minTickGap={45}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            dy={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            domain={['auto', 'auto']}
            tickFormatter={(v) => Number(v.toFixed(1)).toString()}
          />
          <Tooltip
            labelFormatter={(value) =>
              prettyDate(String(value), { day: 'numeric', month: 'long', year: 'numeric' })
            }
            formatter={(value, name) => [
              Array.isArray(value)
                ? `${value.map((v) => Number(v).toFixed(2)).join(' – ')} ${unit}`
                : `${Number(value).toFixed(2)} ${unit}`,
              name,
            ]}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text)' }}
          />
          {!simple && (
            <>
              <Area
                dataKey="predictive"
                name="95% predictive interval"
                stroke="none"
                fill="var(--chart-predictive)"
                isAnimationActive={false}
              />
              <Area
                dataKey="credible"
                name="95% credible interval"
                stroke="none"
                fill="var(--chart-credible)"
                fillOpacity={0.65}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="mean"
                name="Posterior mean"
                stroke="var(--chart-mean)"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </>
          )}
          <Line
            type="linear"
            dataKey="observed"
            name="Observed"
            stroke={simple ? 'var(--chart-mean)' : 'transparent'}
            strokeWidth={2.5}
            dot={
              simple
                ? false
                : { r: 3, fill: 'var(--chart-mean)', stroke: 'var(--surface)', strokeWidth: 1 }
            }
            connectNulls={false}
            isAnimationActive={false}
          />
          {forecastStart && (
            <ReferenceLine
              x={forecastStart}
              stroke="var(--chart-forecast)"
              strokeDasharray="4 4"
              label={{
                value: 'Forecast →',
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--chart-forecast)',
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
