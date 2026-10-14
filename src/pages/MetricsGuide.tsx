import { useState } from 'react';
import { featureCatalog, references } from '../../shared/features';
import { Field, PageHeading, Panel } from '../components/ui';
export function MetricsGuide() {
  const [query, setQuery] = useState('');
  const catalog = featureCatalog().filter((f) =>
    `${f.label} ${f.description} ${f.group}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="DEFINITIONS & METHODS"
        title="Know what the numbers mean."
        description="Recorded measurements, transparent transformations, and the mathematics behind each analysis."
      />
      <Panel title="Reading a relationship">
        <dl className="method-glossary">
          <dt>Pearson r</dt>
          <dd>
            Centered cross-product divided by the product of centered vector lengths. Describes
            linear association from −1 to +1. Undefined when either variable is constant.
            Binary/numeric Pearson is the point-biserial correlation.
          </dd>
          <dt>Spearman ρ</dt>
          <dd>
            Pearson correlation of average ranks, including tied ratings. Describes monotonic
            association and is less sensitive to extreme magnitudes. It does not remove confounding.
          </dd>
          <dt>Day-to-day change</dt>
          <dd>
            x(d) − x(d−1), only when both actual calendar dates are recorded. Useful for separating
            changes from sustained level differences.
          </dd>
          <dt>Detrended association</dt>
          <dd>
            Fit each aligned variable to an intercept and elapsed days, then correlate the
            residuals. Removes linear co-trending, not all trends or confounders.
          </dd>
          <dt>Trailing means</dt>
          <dd>
            Arithmetic mean of all 7 or 28 calendar days ending on the relevant date. A single
            missing/excluded day makes the mean unknown. Overlapping windows share data; the
            bootstrap block is at least the window length.
          </dd>
          <dt>Lag</dt>
          <dd>
            A predictor on date d is paired with an outcome on d + lag. Sleep is recorded on the
            waking date. Lag is timing, not proof of causation.
          </dd>
          <dt>Block-bootstrap interval</dt>
          <dd>
            Resample contiguous calendar blocks, preserving within-block pairs and missing slots.
            Take the 2.5th and 97.5th percentiles of 200 reproducible replicates. Approximate under
            local stationarity, not a Bayesian credible interval or a multiple-testing correction.
          </dd>
          <dt>Bayesian conditional coefficient</dt>
          <dd>
            The modeled outcome difference for a one-unit input difference, holding other selected
            inputs fixed. Proper Normal–Inverse-Gamma priors shrink coefficients and yield Student-t
            marginals. Coefficients describe the chosen model, not interventions.
          </dd>
          <dt>MAE, RMSE and interval coverage</dt>
          <dd>
            Mean absolute prediction error; square root of mean squared error; fraction of later
            observations inside predictive intervals. Compared on chronologically held-out data. Low
            in-sample error alone does not show forecast skill.
          </dd>
        </dl>
      </Panel>
      <Panel
        title="Metric and label dictionary"
        subtitle={`${featureCatalog().length} built-in numeric and categorical inputs, plus your reusable context labels.`}
      >
        <Field label="Find a definition">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sleep, effort, HRV, symptom…"
          />
        </Field>
        <div className="definition-grid">
          {catalog.map((f) => (
            <article key={f.id}>
              <span className="eyebrow">{f.group}</span>
              <h3>
                {f.label} <small>{f.unit}</small>
              </h3>
              <p>{f.description}</p>
              {f.reference && (
                <a
                  className="text-link"
                  href={references[f.reference].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {references[f.reference].title}
                </a>
              )}
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="Scope of the evidence">
        <p>
          Published methods explain the mathematics and measurement concepts. They do not validate
          this application, its project-defined scales, a particular user’s forecast, or a causal
          relationship. No readiness, longevity, injury-risk or medical-treatment score is inferred.
          Custom context labels are explicit presence/absence indicators, with unknown kept
          separate.
        </p>
        <ul>
          {Object.values(references).map((r) => (
            <li key={r.url}>
              <a className="text-link" href={r.url} target="_blank" rel="noreferrer">
                {r.title}
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
