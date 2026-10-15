import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { useMemo, useState } from 'react';
import { metrics, type MetricKey } from '../../shared/metrics';
import {
  analyzeRelationships,
  type RelationshipSettings,
  type RelationshipView,
} from '../../shared/relationships';
import { useApi, download } from '../lib/api';
import { useAnalysis } from '../lib/use-analysis';
import { FeaturePicker, useAnalysisData } from '../components/AnalysisData';
import { RelationshipChart } from '../components/RelationshipChart';
import { ErrorBox, Field, PageHeading, Panel, number } from '../components/ui';
export function Relationships() {
  const { demo } = useApi();
  const data = useAnalysisData();
  const [target, setTarget] = useState<MetricKey>('wellbeing'),
    [predictor, setPredictor] = useState('sleepHours'),
    [lag, setLag] = useState(0),
    [view, setView] = useState<RelationshipView>('daily'),
    [method, setMethod] = useState<'pearson' | 'spearman'>('spearman'),
    [block, setBlock] = useState(7),
    [selected, setSelected] = useState<string[]>(Object.keys(metrics));
  const activeInputs = useMemo(
    () => selected.filter((id) => id !== target && data.catalog.some((f) => f.id === id)),
    [selected, target, data.catalog],
  );
  const activePredictor = data.catalog.some(
    (f) => f.id === predictor && (lag > 0 || f.id !== target),
  )
    ? predictor
    : data.catalog.find((f) => f.id !== target)!.id;
  const settings = useMemo<RelationshipSettings>(
    () => ({
      target,
      predictor: activePredictor,
      features: activeInputs,
      lag,
      view,
      method,
      block,
    }),
    [target, activePredictor, activeInputs, lag, view, method, block],
  );
  const job = useMemo(
    () =>
      data.loading || data.error || !data.entries.length
        ? null
        : { kind: 'relationships' as const, entries: data.entries, settings },
    [data.loading, data.error, data.entries, settings],
  );
  const analysis = useAnalysis<ReturnType<typeof analyzeRelationships>>(job),
    result = analysis.result;
  const chosen = data.catalog.find((f) => f.id === activePredictor);
  return (
    <>
      <PageHeading
        eyebrow="FIND CONNECTIONS"
        title="What moves together?"
        description="Compare measurements and context, across days and longer patterns."
      />
      {data.controls}
      <Panel>
        <div className="fields-grid three">
          <Field label="Outcome">
            <select value={target} onChange={(e) => setTarget(e.target.value as MetricKey)}>
              {Object.entries(metrics).map(([id, m]) => (
                <option key={id} value={id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Compare with">
            <select value={activePredictor} onChange={(e) => setPredictor(e.target.value)}>
              {data.catalog
                .filter((f) => lag > 0 || f.id !== target)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Outcome occurs">
            <select value={lag} onChange={(e) => setLag(Number(e.target.value))}>
              {[0, 1, 2, 3, 7, 14, 28].map((n) => (
                <option key={n} value={n}>
                  {n === 0
                    ? 'On the same journal date'
                    : `${n} calendar day${n === 1 ? '' : 's'} later`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Perspective">
            <select value={view} onChange={(e) => setView(e.target.value as RelationshipView)}>
              <option value="daily">Recorded daily levels</option>
              <option value="changes">Changes from the previous day</option>
              <option value="detrended">Remove each linear time trend</option>
              <option value="week">Trailing 7-day numeric means</option>
              <option value="month">Trailing 28-day numeric means</option>
            </select>
          </Field>
          <Field label="Correlation method">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'pearson' | 'spearman')}
            >
              <option value="spearman">Spearman · monotonic association</option>
              <option value="pearson">Pearson · linear association</option>
            </select>
          </Field>
          <Field label="Bootstrap block length">
            <select value={block} onChange={(e) => setBlock(Number(e.target.value))}>
              {[7, 14, 28].map((n) => (
                <option key={n} value={n}>
                  {n} calendar days
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="small muted">
          Sleep belongs to the waking date. Training Monday → sleep Tuesday describes the night
          after training. Same-date sleep usually precedes that day’s training; within-day ordering
          is not measured. Rolling means require every day in the window; binary labels use the
          predictor day.
        </p>
      </Panel>
      {!data.loading &&
        selected.some((id) => id !== target && !data.catalog.some((f) => f.id === id)) && (
          <p role="status">
            Some selected inputs have no matching observations and are excluded. Open Choose inputs
            to review them.
          </p>
        )}
      <FeaturePicker
        catalog={data.catalog}
        selected={selected}
        onChange={setSelected}
        target={target}
      />
      <ErrorBox message={data.error || analysis.error} />
      {(data.loading || analysis.busy) && <p role="status">Calculating aligned relationships…</p>}
      {!data.loading && !data.entries.length && (
        <Panel>
          <p>
            No observations match this selection. Try All recorded dates, clear observation filters,
            or add a check-in.
          </p>
          <Link className="button secondary" to="/check-in">
            Add a check-in
          </Link>{' '}
          <Link className="text-link" to="/import">
            Import journal data
          </Link>
        </Panel>
      )}
      {result && (
        <>
          <div className="analysis-stats">
            <div>
              <span className="stat-label">
                {method === 'spearman' ? 'Spearman ρ' : 'Pearson r'}
              </span>
              <strong>{number(result.selected.coefficient, 2)}</strong>
              <p>{result.selected.n} aligned pairs; 14 required, with variation</p>
            </div>
            <div>
              <span className="stat-label">Approximate 95% block-bootstrap interval</span>
              <strong className="compact-stat">
                {result.interval
                  ? result.interval.interval.map((v) => number(v, 2)).join(' to ')
                  : 'Not available'}
              </strong>
              <p>
                {result.interval
                  ? `${result.interval.block}-day blocks · ${result.interval.validReplicates} replicates`
                  : 'Needs 28 pairs and a span of at least 4 blocks'}
              </p>
            </div>
            <div>
              <span className="stat-label">Compare definitions</span>
              <strong className="compact-stat">
                r {number(result.selected.pearson, 2)} · ρ {number(result.selected.spearman, 2)}
              </strong>
              <p>Linear vs rank association; neither implies causation</p>
            </div>
          </div>
          <Panel
            title={`${chosen?.label} → ${metrics[target].label}`}
            subtitle={chosen?.description}
          >
            <RelationshipChart
              pairs={result.pairs}
              xLabel={chosen?.label || predictor}
              yLabel={metrics[target].label}
            />
            <p className="small muted">
              An arrow specifies time alignment, not causal influence. Points use the selected
              transformation. A shared trend, reverse direction, unmeasured factors and selective
              recording can explain a relationship.
            </p>
          </Panel>
          <div className="analysis-explanation">
            <Panel
              title="Strongest observed associations"
              subtitle="Sorted by absolute coefficient for this outcome, lag and selection. Each row may use different days."
            >
              <div className="association-list">
                {result.ranking.map((r) => (
                  <button
                    key={r.id}
                    className={`association-row ${r.id === predictor ? 'selected' : ''}`}
                    onClick={() => setPredictor(r.id)}
                  >
                    <span>
                      {r.label}
                      <small>{r.n} pairs</small>
                    </span>
                    <span className="association-bar">
                      <i style={{ width: `${Math.abs(r.coefficient ?? 0) * 100}%` }} />
                    </span>
                    <strong>{number(r.coefficient, 2)}</strong>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Does the timing change the pattern?">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Outcome later by</th>
                      <th>{method === 'pearson' ? 'r' : 'ρ'}</th>
                      <th>Pairs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lagProfile.map((row) => (
                      <tr key={row.lag}>
                        <td>
                          <button className="text-link" onClick={() => setLag(row.lag)}>
                            {row.lag} days
                          </button>
                        </td>
                        <td>{number(row.coefficient, 2)}</td>
                        <td>{row.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">
                Scanning many metrics, lags and filters makes large chance correlations more likely.
                Rankings are exploration, with no significance stars or causal winners. Bootstrap
                intervals are approximate under local stationarity, sensitive to block length and
                not adjusted for this search.
              </p>
            </Panel>
          </div>
          <Panel title="Reproduce this result">
            <p>
              Missing pairs are excluded; gaps are never compressed. The download contains the exact
              pairs, settings, rankings and bootstrap seed. It contains personal observations.
            </p>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  JSON.stringify({ ...result, synthetic: demo, selection: data.settings }, null, 2),
                  'teddmhen-relationships.json',
                  'application/json',
                )
              }
            >
              Download relationship analysis
            </button>
          </Panel>
        </>
      )}
    </>
  );
}
