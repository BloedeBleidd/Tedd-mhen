import { useMemo, useState } from 'react';
import { metrics, type MetricKey } from '../../shared/metrics';
import { fitMultivariable, type ModelSettings } from '../../shared/multivariable';
import type { Prior } from '../../shared/bayes';
import { useAnalysis } from '../lib/use-analysis';
import { download } from '../lib/api';
import { FeaturePicker, useAnalysisData } from '../components/AnalysisData';
import { TrendChart } from '../components/Charts';
import { ErrorBox, Field, PageHeading, Panel, number } from '../components/ui';
export function Prediction() {
  const data = useAnalysisData();
  const [target, setTarget] = useState<MetricKey>('wellbeing'),
    [features, setFeatures] = useState(['sleepHours', 'trainingLoad', 'stress', 'trained']),
    [horizon, setHorizon] = useState(1),
    [window, setWindow] = useState(1),
    [prior, setPrior] = useState<Prior>('regular'),
    [history, setHistory] = useState(true),
    [time, setTime] = useState(true);
  const settings = useMemo<ModelSettings>(
    () => ({ target, features, horizon, window, prior, history, time }),
    [target, features, horizon, window, prior, history, time],
  );
  const job = useMemo(
    () =>
      data.loading || data.error || !data.entries.length
        ? null
        : { kind: 'model' as const, entries: data.entries, settings },
    [data.loading, data.error, data.entries, settings],
  );
  const analysis = useAnalysis<ReturnType<typeof fitMultivariable>>(job),
    result = analysis.result,
    model = result?.ready ? result : null,
    spec = metrics[target];
  return (
    <>
      <PageHeading
        eyebrow="MANY SIGNALS, ONE OUTCOME"
        title="Put your observations together."
        description="A Bayesian model using multiple measured series and recorded labels, with a chronological prediction check."
      />
      {data.controls}
      <Panel>
        <div className="fields-grid three">
          <Field label="Predict an outcome">
            <select value={target} onChange={(e) => setTarget(e.target.value as MetricKey)}>
              {Object.entries(metrics).map(([id, m]) => (
                <option key={id} value={id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prediction timing">
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              <option value={0}>Same-day conditional estimate</option>
              {[1, 3, 7].map((n) => (
                <option key={n} value={n}>
                  {n} calendar day{n === 1 ? '' : 's'} ahead
                </option>
              ))}
            </select>
          </Field>
          <Field label="Numeric predictor history">
            <select value={window} onChange={(e) => setWindow(Number(e.target.value))}>
              <option value={1}>At the forecast origin</option>
              <option value={7}>Previous 7 days, including origin</option>
              <option value={28}>Previous 28 days, including origin</option>
            </select>
          </Field>
          <Field label="Coefficient prior">
            <select value={prior} onChange={(e) => setPrior(e.target.value as Prior)}>
              <option value="weak">Weak shrinkage</option>
              <option value="regular">Regular shrinkage</option>
              <option value="strong">Strong shrinkage</option>
            </select>
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
            />
            Include outcome history
          </label>
          <label className="check-label">
            <input type="checkbox" checked={time} onChange={(e) => setTime(e.target.checked)} />
            Adjust for linear calendar trend
          </label>
        </div>
        <p className="small muted">
          Each row predicts outcome on day d + {horizon} from observations available through day d.
          Labels refer to day d. Same-day estimates require those day’s inputs and are not advance
          forecasts. The outcome itself is excluded from same-day inputs; outcome history uses the
          preceding day.
        </p>
      </Panel>
      <FeaturePicker
        catalog={data.catalog}
        selected={features}
        onChange={setFeatures}
        target={target}
      />
      <ErrorBox message={data.error || analysis.error} />
      {(data.loading || analysis.busy) && (
        <p role="status">Fitting the Bayesian model and temporal holdout…</p>
      )}
      {!data.loading && !data.entries.length && (
        <Panel>
          <p>No recorded observations. Add check-ins or explore the synthetic demo.</p>
        </Panel>
      )}
      {result && (
        <>
          <div className="analysis-stats">
            <div>
              <span className="stat-label">Complete model rows</span>
              <strong>
                {result.n}
                <small> / {result.observed}</small>
              </strong>
              <p>{result.excluded} excluded for missing inputs</p>
            </div>
            <div>
              <span className="stat-label">Active predictors</span>
              <strong>
                {result.active}
                <small> / {result.selected}</small>
              </strong>
              <p>Plus intercept{time ? ' and calendar trend' : ''}</p>
            </div>
            <div>
              <span className="stat-label">Required observations</span>
              <strong>{result.minimum}</strong>
              <p>A display threshold, not evidence of validity</p>
            </div>
          </div>
          {!result.ready && (
            <Panel>
              <p role="status">{result.reason}</p>
            </Panel>
          )}
          {result.dropped.length > 0 && (
            <details className="panel model-details">
              <summary>Inputs not used · {result.dropped.length}</summary>
              <ul>
                {result.dropped.map((d) => (
                  <li key={d.id}>
                    <strong>{d.label}:</strong> {d.reason}
                  </li>
                ))}
              </ul>
              <p>
                Screening uses the training period when there is enough history. No values are
                imputed; remaining incomplete rows are excluded.
              </p>
            </details>
          )}
        </>
      )}
      {model && (
        <>
          <Panel
            title="Conditional prediction"
            subtitle="Uses the latest recorded predictor date, not an assumed future value."
          >
            {model.future ? (
              <>
                <div className="forecast-result">
                  <span>
                    {model.future.origin} → {model.future.date}
                    {model.future.observed !== null ? ' · outcome already observed' : ''}
                  </span>
                  <strong>
                    {number(model.future.mean, 2)} <small>{spec.unit}</small>
                  </strong>
                  <span>
                    95% predictive interval:{' '}
                    <b>
                      {model.future.predictive.map((v) => number(v, 2)).join(' to ')} {spec.unit}
                    </b>
                  </span>
                </div>
                <details>
                  <summary>Inputs behind this prediction</summary>
                  <ul>
                    {model.future.inputs.map((input) => (
                      <li key={input.id}>
                        {input.label}: {number(input.value, 2)}
                        {input.outsideRange ? ' · outside the fitted input range' : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <p>
                The latest recorded day lacks one or more active inputs. No forecast is filled in or
                silently moved to an older day.
              </p>
            )}
            <p className="small muted">
              Prediction conditions on recorded inputs; their measurement error is not modeled. It
              does not simulate interventions or guarantee accuracy.{' '}
              {model.future && model.future.origin < new Date().toISOString().slice(0, 10)
                ? `The latest predictor date is ${model.future.origin}; this is not a forecast from today.`
                : ''}
            </p>
          </Panel>
          <Panel
            title="Model fit and uncertainty"
            subtitle="Descriptive fit on all complete selected rows. Forecast performance is evaluated separately below."
          >
            <TrendChart
              data={[...model.curve, ...(model.future?.forecast ? [model.future] : [])]}
              unit={spec.unit}
              forecastStart={model.future?.forecast ? model.curve.at(-1)?.date : undefined}
            />
            <div className="chart-legend">
              <span>Points: observed</span>
              <span>Line: posterior mean</span>
              <span>Dark band: 95% credible interval</span>
              <span>Light band: 95% predictive interval</span>
            </div>
          </Panel>
          <Panel
            title="Does it predict later observations?"
            subtitle="Last 20% of outcome dates held out. Training outcomes strictly precede the first validation origin; no random split."
          >
            {model.validation ? (
              <>
                <div className="analysis-stats">
                  <div>
                    <span className="stat-label">Held-out MAE</span>
                    <strong>
                      {number(model.validation.mae, 2)}
                      <small> {spec.unit}</small>
                    </strong>
                    <p>
                      {model.validation.n} predictions; {model.validation.trainN} training rows
                    </p>
                  </div>
                  <div>
                    <span className="stat-label">Persistence baseline MAE</span>
                    <strong>{number(model.validation.persistenceMae, 2)}</strong>
                    <p>
                      {model.validation.persistenceN} paired rows · predicts the last known outcome
                    </p>
                  </div>
                  <div>
                    <span className="stat-label">95% interval coverage</span>
                    <strong>
                      {number(model.validation.coverage * 100)}
                      <small>%</small>
                    </strong>
                    <p>Observed coverage in this small holdout, not a calibration guarantee</p>
                  </div>
                </div>
                <p>
                  RMSE: {number(model.validation.rmse, 2)}. Model MAE on the same persistence rows:{' '}
                  {number(model.validation.matchedModelMae, 2)}. Training-mean baseline MAE:{' '}
                  {number(model.validation.meanBaselineMae, 2)}. Lower error is better. Last
                  training outcome: {model.validation.lastTrainingOutcome}; first validation origin:{' '}
                  {model.validation.firstValidationOrigin}. {model.validation.excluded} later
                  outcomes excluded for missing inputs.
                </p>
                <details>
                  <summary>Held-out predictions</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Observed</th>
                          <th>Predicted</th>
                          <th>95% predictive interval</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.validation.predictions.map((p) => (
                          <tr key={p.date}>
                            <td>{p.date}</td>
                            <td>{number(p.observed, 2)}</td>
                            <td>{number(p.mean, 2)}</td>
                            <td>{p.predictive.map((v) => number(v, 2)).join(' to ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <p>{model.validationUnavailableReason}</p>
            )}
            <p className="small muted">
              Repeatedly choosing inputs after viewing this score tunes to the holdout. Confirm the
              final specification on newly collected days. Missingness, serial dependence and device
              changes can bias evaluation.
            </p>
          </Panel>
          <Panel
            title="Conditional associations"
            subtitle="Sorted by absolute predicted change for one observed standard deviation of an input, holding the other inputs fixed."
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Change per 1 SD</th>
                    <th>Change per unit / label 0→1</th>
                    <th>95% credible interval per unit</th>
                    <th>P(coefficient &gt; 0)</th>
                  </tr>
                </thead>
                <tbody>
                  {model.coefficients.map((c) => (
                    <tr key={c.id}>
                      <td>{c.label}</td>
                      <td>{number(c.typicalChange, 2)}</td>
                      <td>{number(c.value, 2)}</td>
                      <td>{c.interval.map((v) => number(v, 2)).join(' to ')}</td>
                      <td>{number(c.probabilityPositive * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">
              All changes are in {spec.label.toLowerCase()} units ({spec.unit}). This is a
              conditional association under the chosen prior and Gaussian model, not a causal
              influence or a measure of clinical importance. Correlated inputs can split or reverse
              coefficients; rank and sign can change with the selected inputs.
            </p>
          </Panel>
          <Panel title="Model checks and limits">
            <ul>
              <li>
                {model.collinear.length} pairs of inputs have |r| &gt; 0.95.
                {model.collinear.length > 0
                  ? ' Their separate contributions are difficult to identify.'
                  : ''}
              </li>
              <li>
                Consecutive-day residual correlation: {number(model.residualCorrelation, 2)} (
                {model.residualPairs} pairs). Serial dependence is not corrected by this model and
                can make intervals too narrow.
              </li>
              <li>
                {model.boundaryWarning
                  ? 'Some predictive intervals extend beyond the metric’s input scale. Intervals are deliberately not clipped.'
                  : 'Intervals are unbounded Gaussian-model quantities; they are not probabilities of health.'}
              </li>
              <li>
                All-source / all-method selections can mix incomparable measurements. Source labels
                do not calibrate devices. Filter HRV to a consistent method.
              </li>
              <li>
                Same-day symptoms and ratings may describe the same experience. Their association is
                not independent evidence of a cause.
              </li>
            </ul>
          </Panel>
          <Panel title="Model specification & reproducibility">
            <p>
              Normal–Inverse-Gamma multivariable regression; proper shrinkage priors, exact
              Student-t marginal intervals and Cholesky matrix solution. Numeric and binary inputs
              are centered and scaled; outcome scaling is fixed. Variance prior: InvGamma(2,1).
              Intercept conditional variance: 10; other coefficient variance:{' '}
              {model.priorVariance[1]}. Notes are excluded.
            </p>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  JSON.stringify({ ...model, selection: data.settings }, null, 2),
                  'teddmhen-multivariable-model.json',
                  'application/json',
                )
              }
            >
              Download model, design & validation
            </button>
            <p className="small muted">
              This file includes personal observations and model inputs. One selected outcome is
              modeled from multiple series; this is not a joint causal system or an automatically
              validated health model.
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
