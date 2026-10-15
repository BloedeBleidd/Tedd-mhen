import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, Info } from 'lucide-react';
import { useApi, useLoad, download } from '../lib/api';
import { dayNumber, localDate, shiftDate, type EntrySummary } from '../../shared/schema';
import { metrics, type MetricKey } from '../../shared/metrics';
import { fitTrend, MIN_OBSERVATIONS, observationsFor, type Prior } from '../../shared/bayes';
import { TrendChart } from '../components/Charts';
import {
  EmptyState,
  ErrorBox,
  Field,
  HelpLink,
  Loading,
  number,
  PageHeading,
  Panel,
  prettyDate,
} from '../components/ui';
export function Analysis() {
  const { demo } = useApi();
  const [from, setFrom] = useState(shiftDate(localDate(), -27)),
    [to, setTo] = useState(localDate()),
    [metric, setMetric] = useState<MetricKey>('wellbeing'),
    [prior, setPrior] = useState<Prior>('regular'),
    [horizon, setHorizon] = useState(7),
    [illness, setIllness] = useState('all'),
    [method, setMethod] = useState('all'),
    [source, setSource] = useState('all');
  const valid = from && to && from <= to && dayNumber(to) - dayNumber(from) <= 1830;
  const { data, loading, error } = useLoad<{ entries: EntrySummary[] }>(
    valid ? `/api/series?from=${from}&to=${to}&illness=${illness}` : null,
  );
  const entries = useMemo(
    () =>
      (data?.entries || []).filter(
        (e) =>
          (source === 'all' || e.physiology.source === source) &&
          (metric !== 'hrv' || method === 'all' || e.physiology.hrvMethod === method),
      ),
    [data, metric, method, source],
  );
  const observations = useMemo(() => observationsFor(entries, metric), [entries, metric]);
  const model = useMemo(
    () => fitTrend(observations, metric, prior, horizon),
    [observations, metric, prior, horizon],
  );
  const spec = metrics[metric],
    last = model?.curve.at(-1);
  const observedDays = new Set(observations.map((o) => o.date)),
    selectedDays = valid ? dayNumber(to) - dayNumber(from) + 1 : 0;
  const methods = new Set(
    entries.filter((e) => e.physiology.hrv !== null).map((e) => e.physiology.hrvMethod),
  );
  const sources = new Set(entries.map((e) => e.physiology.source));
  return (
    <>
      <PageHeading
        eyebrow="FOLLOW THE EVIDENCE"
        title="A pattern, or just a day?"
        description="Explore your trajectory, with room for uncertainty."
        action={<HelpLink />}
      />
      <Panel className="filter-panel">
        <div className="analysis-filters">
          <Field label="What would you like to understand?">
            <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
              {Object.entries(metrics).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Forecast horizon">
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              <option value="0">No forecast</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
            </select>
          </Field>
        </div>
        <details className="analysis-options">
          <summary>Model settings & data selection</summary>
          <div className="fields-grid three">
            <Field label="Prior on the weekly slope">
              <select value={prior} onChange={(e) => setPrior(e.target.value as Prior)}>
                <option value="weak">Weak shrinkage</option>
                <option value="regular">Regular shrinkage</option>
                <option value="strong">Strong shrinkage</option>
              </select>
            </Field>
            <Field label="Illness selection">
              <select value={illness} onChange={(e) => setIllness(e.target.value)}>
                <option value="all">All days, including unknown</option>
                <option value="no">Only explicitly illness-free days</option>
                <option value="yes">Only illness / symptom days</option>
              </select>
            </Field>
            <Field label="Measurement source">
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="all">All sources</option>
                {['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            {metric === 'hrv' && (
              <Field label="HRV method">
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="all">All methods</option>
                  <option value="rmssd">rMSSD only</option>
                  <option value="sdnn">SDNN only</option>
                  <option value="unknown">Unknown method only</option>
                </select>
              </Field>
            )}
          </div>
          <p className="muted small">
            Priors shrink the weekly slope toward zero. Compare settings to see how much your
            conclusion depends on that assumption.
          </p>
        </details>
      </Panel>
      <ErrorBox message={!valid ? 'Select a valid date range of up to five years.' : error} />
      {loading ? (
        <Loading />
      ) : (
        valid &&
        !error && (
          <>
            {model ? (
              <>
                <div className="analysis-stats">
                  <div>
                    <span className="stat-label">Recorded observations</span>
                    <strong>
                      {model.n}
                      <small> / {selectedDays} days</small>
                    </strong>
                    <p>{selectedDays - observedDays.size} days missing or excluded</p>
                  </div>
                  <div>
                    <span className="stat-label">Estimated weekly change</span>
                    <strong>
                      {model.slope >= 0 ? '+' : ''}
                      {number(model.slope, 2)}
                      <small> {spec.unit}</small>
                    </strong>
                    <p>
                      95% CrI: {number(model.slopeInterval[0], 2)} to{' '}
                      {number(model.slopeInterval[1], 2)}
                    </p>
                  </div>
                  <div>
                    <span className="stat-label">Probability of an increasing trend</span>
                    <strong>
                      {number(model.probabilityIncreasing * 100)}
                      <small>%</small>
                      {model.slope >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                    </strong>
                    <p>Conditional on this model and prior</p>
                  </div>
                </div>
                <Panel
                  title={`${spec.label}, with perspective`}
                  subtitle={`${prettyDate(model.firstDate)} – ${prettyDate(model.lastDate)} · ${horizon ? `${horizon}-day extrapolation from the last observation` : 'Observed period only'}`}
                  action={<span className="tag">Bayesian linear trend</span>}
                >
                  <TrendChart
                    data={model.curve}
                    forecastStart={horizon ? model.lastDate : undefined}
                    unit={spec.unit}
                  />
                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot" /> Observed
                    </span>
                    <span>
                      <i className="legend-line" /> Posterior mean
                    </span>
                    <span>
                      <i className="legend-area credible" /> 95% credible interval
                    </span>
                    <span>
                      <i className="legend-area" /> 95% predictive interval
                    </span>
                  </div>
                </Panel>
                <div className="analysis-explanation">
                  <Panel title="What this suggests">
                    <p className="finding">
                      {model.slopeInterval[0] > 0
                        ? 'The model supports an increasing trend in this window.'
                        : model.slopeInterval[1] < 0
                          ? 'The model supports a decreasing trend in this window.'
                          : 'The direction is still uncertain in this window.'}
                    </p>
                    <p className="muted">
                      Increasing is a direction, not a judgment of health. This is a within-person
                      time trend; it does not explain what caused the change.
                    </p>
                    {horizon > 0 && last && (
                      <div className="forecast-result">
                        <span>
                          For{' '}
                          {prettyDate(last.date, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <strong>
                          {number(last.mean, 2)} <small>{spec.unit}</small>
                        </strong>
                        <span>
                          Single-observation 95% predictive interval:
                          <br />
                          <b>
                            {number(last.predictive[0], 2)} – {number(last.predictive[1], 2)}{' '}
                            {spec.unit}
                          </b>
                        </span>
                      </div>
                    )}
                  </Panel>
                  <Panel title="Before you draw a conclusion">
                    <ul className="insight-list">
                      <li>
                        <Info size={16} />
                        <span>
                          The darker band describes uncertainty about the average trend. The lighter
                          band includes day-to-day variation.
                        </span>
                      </li>
                      <li>
                        <Info size={16} />
                        <span>
                          {model.residualAutocorrelation !== null
                            ? `Consecutive-day residual correlation: ${number(model.residualAutocorrelation, 2)} (${model.residualPairs} pairs). ${Math.abs(model.residualAutocorrelation) > 0.3 ? 'Dependence may make these intervals too narrow.' : 'This diagnostic does not establish independence.'}`
                            : 'Too few consecutive-day residual pairs to assess serial dependence.'}
                        </span>
                      </li>
                      {model.boundaryWarning && (
                        <li>
                          <Info size={16} />
                          <span>
                            The Gaussian model extends beyond this metric’s physical scale.
                            Intervals are shown untrimmed; treat boundary forecasts cautiously.
                          </span>
                        </li>
                      )}
                      {metric === 'hrv' && (methods.size > 1 || methods.has('unknown')) && (
                        <li>
                          <Info size={16} />
                          <span>
                            HRV methods are mixed or unknown. Select one known method for a more
                            interpretable trend.
                          </span>
                        </li>
                      )}
                      {sources.size > 1 && (
                        <li>
                          <Info size={16} />
                          <span>
                            This selection mixes measurement sources. Device changes can resemble
                            changes in health.
                          </span>
                        </li>
                      )}
                      {to > model.lastDate && (
                        <li>
                          <Info size={16} />
                          <span>
                            The last observation is {model.lastDate}. Forecast dates are based on
                            that observation, not today.
                          </span>
                        </li>
                      )}
                      <li>
                        <Info size={16} />
                        <span>
                          Missingness and illness filtering can bias the sample. Fourteen
                          observations are a display threshold, not a guarantee of reliable
                          inference.
                        </span>
                      </li>
                    </ul>
                  </Panel>
                </div>
                <details className="panel model-details">
                  <summary>Model specification, values & reproducibility</summary>
                  <p>
                    y = intercept + slope × centered elapsed weeks + Gaussian noise. Fixed scaling:
                    (value − {model.prior.center}) / {model.prior.scale}. Prior variance:
                    InvGamma(2, 1); coefficient covariance conditional on noise: diag(10,{' '}
                    {model.prior.slopeVariance}). Posterior degrees of freedom: {model.posterior.df}
                    .
                  </p>
                  <button
                    className="button secondary small-button"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          {
                            synthetic: demo,
                            settings: { metric, from, to, prior, horizon, illness, method, source },
                            observations,
                            model,
                          },
                          null,
                          2,
                        ),
                        `teddmhen-model-${metric}.json`,
                        'application/json',
                      )
                    }
                  >
                    <Download size={15} /> Download model & observations
                  </button>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Observed</th>
                          <th>Mean</th>
                          <th>95% credible interval</th>
                          <th>95% predictive interval</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.curve.map((row) => (
                          <tr key={row.date}>
                            <td>
                              {row.date}
                              {row.forecast ? ' *' : ''}
                            </td>
                            <td>{number(row.observed, 2)}</td>
                            <td>{number(row.mean, 2)}</td>
                            <td>{row.credible.map((v) => number(v, 2)).join(' – ')}</td>
                            <td>{row.predictive.map((v) => number(v, 2)).join(' – ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <Panel>
                <EmptyState
                  title="Let the evidence build."
                  description={`${observations.length} of ${MIN_OBSERVATIONS} required observations for ${spec.label.toLowerCase()}. Record more days or widen your date range; missing values remain missing.`}
                  action={false}
                />
              </Panel>
            )}
          </>
        )
      )}
      <p className="data-caption">
        Exploratory statistics, not a diagnostic or validated forecasting system. Predictions assume
        the current linear pattern continues.
      </p>
    </>
  );
}
