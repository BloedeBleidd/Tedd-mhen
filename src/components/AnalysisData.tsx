import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../lib/api';
import { dayNumber, localDate, shiftDate, type EntrySummary } from '../../shared/schema';
import { featureCatalog, type Feature } from '../../shared/features';
import { Field, Panel } from './ui';
export function useAnalysisData() {
  const [from, setFrom] = useState(shiftDate(localDate(), -179)),
    [to, setTo] = useState(localDate()),
    [all, setAll] = useState(false),
    [illness, setIllness] = useState('all'),
    [source, setSource] = useState('all'),
    [method, setMethod] = useState('all'),
    [label, setLabel] = useState('all'),
    [training, setTraining] = useState('all');
  const valid = all || Boolean(from && to && from <= to && dayNumber(to) - dayNumber(from) <= 1830);
  const data = useLoad<{ entries: EntrySummary[] }>(
    valid ? `/api/series?${all ? 'all=true' : `from=${from}&to=${to}`}` : null,
  );
  const entries = useMemo(
    () =>
      (data.data?.entries || []).filter(
        (e) =>
          (illness === 'all' ||
            (illness === 'no'
              ? e.illnessSeverity === 0
              : (e.illnessSeverity ?? 0) > 0 || e.symptoms.length > 0)) &&
          (source === 'all' || e.physiology.source === source) &&
          (method === 'all' || e.physiology.hrvMethod === method) &&
          (training === 'all' || e.trainingStatus === training) &&
          (label === 'all' || e.labels?.includes(label)),
      ),
    [data.data, illness, source, method, training, label],
  );
  const catalog = useMemo(() => featureCatalog(data.data?.entries), [data.data]);
  const settings = {
    all,
    from: all ? null : from,
    to: all ? null : to,
    illness,
    source,
    method,
    training,
    label,
  };
  const controls = (
    <Panel
      title="Data selection"
      subtitle="Filters apply to outcome days and predictor/history days. Excluded days stay missing."
    >
      <div className="analysis-filters">
        <label className="check-label">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          All recorded dates
        </label>
        <Field label="From">
          <input
            type="date"
            disabled={all}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To">
          <input type="date" disabled={all} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <details className="analysis-options">
        <summary>Filter observations</summary>
        <div className="fields-grid three">
          <Field label="Illness selection">
            <select value={illness} onChange={(e) => setIllness(e.target.value)}>
              <option value="all">All, including unknown</option>
              <option value="no">Explicitly illness-free</option>
              <option value="yes">Illness / symptoms</option>
            </select>
          </Field>
          <Field label="Measurement source">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              {['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="HRV method">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="all">All methods</option>
              {['rmssd', 'sdnn', 'unknown'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Training status">
            <select value={training} onChange={(e) => setTraining(e.target.value)}>
              <option value="all">All statuses</option>
              {['trained', 'rest', 'unrecorded'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Required context label">
            <select value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="all">All contexts</option>
              {catalog
                .filter((f) => f.id.startsWith('label:'))
                .map((f) => (
                  <option key={f.id} value={f.id.slice(6)}>
                    {f.id.slice(6)}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </details>
      <p className="small muted">
        {entries.length} of {data.data?.entries.length ?? 0} recorded days selected. All-history
        analysis accepts up to 10,000 days and fails explicitly above that size.{' '}
        <Link to="/analysis/metrics">Definitions & methods</Link>
      </p>
    </Panel>
  );
  return {
    entries,
    catalog,
    settings,
    controls,
    loading: data.loading,
    error: !valid ? 'Choose a valid range of up to five years or All recorded dates.' : data.error,
  };
}
export function FeaturePicker({
  catalog,
  selected,
  onChange,
  target,
}: {
  catalog: Feature[];
  selected: string[];
  onChange: (ids: string[]) => void;
  target: string;
}) {
  const [query, setQuery] = useState('');
  const available = catalog.filter((f) => f.id !== target),
    visible = available
      .filter((f) => `${f.label} ${f.group}`.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 100);
  return (
    <details className="panel feature-picker">
      <summary>Choose inputs · {selected.filter((id) => id !== target).length} selected</summary>
      <div className="picker-actions">
        <button
          className="button secondary small-button"
          onClick={() => onChange(available.map((f) => f.id))}
        >
          Select all inputs
        </button>
        <button
          className="button secondary small-button"
          onClick={() => onChange(available.filter((f) => f.kind === 'numeric').map((f) => f.id))}
        >
          Numeric only
        </button>
        <button className="button secondary small-button" onClick={() => onChange([])}>
          Clear inputs
        </button>
        <input
          aria-label="Find an input"
          placeholder="Find a metric or label…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="feature-grid">
        {visible.map((f) => (
          <label key={f.id} className="feature-choice">
            <input
              type="checkbox"
              checked={selected.includes(f.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...selected, f.id] : selected.filter((id) => id !== f.id),
                )
              }
            />
            <span>
              {f.label}
              <small>
                {f.group} · {f.unit}
              </small>
            </span>
          </label>
        ))}
      </div>
      <p className="small muted">
        Showing up to 100 matching inputs. Search to find others. Model exclusions and missing-data
        counts are reported explicitly. Free-text notes are not inputs.
      </p>
    </details>
  );
}
