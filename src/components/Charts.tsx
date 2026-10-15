import { useTranslation } from 'react-i18next';
import { localize, t as tr } from '../i18n';
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
import { dayNumber } from '../../shared/schema';
import type { Prediction } from '../../shared/bayes';
import { ChartFrame } from './ChartFrame';
import { prettyDate, number } from './ui';
import { useReveal, useReducedMotion } from '../lib/motion';
export function TrendChart({
  data,
  forecastStart,
  unit,
  simple = false,
  validation = false,
}: {
  data: (Pick<Prediction, 'date' | 'mean' | 'observed'> & Partial<Prediction>)[];
  forecastStart?: string;
  unit: string;
  simple?: boolean;
  validation?: boolean;
}) {
  useTranslation();
  const reveal = useReveal<HTMLDivElement>(
    'chart',
    JSON.stringify([data, unit, simple, forecastStart]),
  );
  const reduced = useReducedMotion();
  return (
    <ChartFrame>
      <div
        ref={reveal}
        className="chart"
        role="img"
        aria-label={
          validation
            ? tr('analysisTools:validationChart')
            : tr('charts:timeSeriesIn', {
                value0: unit,
                value1: simple
                  ? tr('charts:recordedValues')
                  : tr('charts:observedValuesPosteriorMean95CredibleIntervalAnd95'),
              })
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data.map((p) => ({ ...p, calendarDay: dayNumber(p.date) }))}
            margin={{ top: 20, right: 18, left: -15, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="calendarDay"
              type="number"
              scale="linear"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) =>
                prettyDate(new Date(Number(value) * 86400000).toISOString().slice(0, 10))
              }
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
              tickFormatter={(v) => number(v, 1)}
            />
            <Tooltip
              isAnimationActive={!reduced}
              animationDuration={120}
              animationEasing="ease-out"
              labelFormatter={(value) =>
                prettyDate(new Date(Number(value) * 86400000).toISOString().slice(0, 10), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              }
              formatter={(value, name) => [
                Array.isArray(value)
                  ? `${value.map((v) => number(Number(v), 2)).join(' – ')} ${unit}`
                  : `${number(Number(value), 2)} ${unit}`,
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
                  className="chart-series chart-band"
                  dataKey="predictive"
                  name={localize('95% predictive interval')}
                  stroke="none"
                  fill="var(--chart-predictive)"
                  isAnimationActive={false}
                />
                {!validation && (
                  <Area
                    className="chart-series chart-band"
                    dataKey="credible"
                    name={localize('95% credible interval')}
                    stroke="none"
                    fill="var(--chart-credible)"
                    fillOpacity={0.65}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  className="chart-series chart-line"
                  type="linear"
                  dataKey="mean"
                  name={validation ? tr('analysisTools:predicted') : localize('Posterior mean')}
                  stroke="var(--chart-mean)"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </>
            )}
            <Line
              className={`chart-series ${simple ? 'chart-line' : 'chart-points'}`}
              type="linear"
              dataKey="observed"
              name={localize('Observed')}
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
                x={dayNumber(forecastStart)}
                stroke="var(--chart-forecast)"
                strokeDasharray="4 4"
                label={{
                  value: tr('charts:forecast'),
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'var(--chart-forecast)',
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
