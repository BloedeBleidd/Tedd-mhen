import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { enumLabel, localize, t as tr } from '../i18n';
import { useMemo, useState } from 'react';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { useLoad } from '../lib/api';
import { dayNumber, localDate, shiftDate, type EntrySummary } from '../../shared/schema';
import { featureCatalog, type Feature } from '../../shared/features';
import { Field, Panel } from './ui';
export function useAnalysisData() {
  useTranslation();
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
  const catalog = useMemo(
    () =>
      featureCatalog(entries).filter(
        (f) =>
          !f.id.startsWith('activity:') ||
          entries.some((e) => e.workoutTypes.includes(f.id.slice(9))),
      ),
    [entries],
  );
  const labelOptions = useMemo(
    () => featureCatalog(data.data?.entries).filter((f) => f.id.startsWith('label:')),
    [data.data],
  );
  const activeFilters = [illness, source, method, label, training].filter(
    (value) => value !== 'all',
  ).length;
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
      title={tr('analysisData:dataSelection')}
      subtitle={tr('analysisData:filtersApplyToOutcomeDaysAndPredictorHistoryDays')}
    >
      <div className="analysis-filters">
        <label className="check-label">
          <Trans
            i18nKey="analysisData:allRecordedDates"
            components={{
              slot0: (
                <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
              ),
            }}
          />
        </label>
        <Field label={tr('analysisData:from')}>
          <input
            type="date"
            disabled={all}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={tr('analysisData:to')}>
          <input type="date" disabled={all} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <details className="analysis-options">
        <summary>
          <Trans
            i18nKey="analysisData:filterObservations"
            components={{
              slot0: (
                <MessageValue
                  value={
                    activeFilters
                      ? tr('analysisData:active', { value0: activeFilters })
                      : tr('analysisData:allIncluded')
                  }
                />
              ),
            }}
          />
        </summary>
        <button
          className="button secondary"
          onClick={() => {
            setIllness('all');
            setSource('all');
            setMethod('all');
            setLabel('all');
            setTraining('all');
          }}
        >
          {tr('analysisData:clearObservationFilters')}
        </button>
        <div className="fields-grid three">
          <Field label={tr('analysisData:illnessSelection')}>
            <select value={illness} onChange={(e) => setIllness(e.target.value)}>
              <option value="all">{tr('analysisData:allIncludingUnknown')}</option>
              <option value="no">{tr('analysisData:explicitlyIllnessFree')}</option>
              <option value="yes">{tr('analysisData:illnessSymptoms')}</option>
            </select>
          </Field>
          <Field label={tr('analysisData:measurementSource')}>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">{tr('analysisData:allSources')}</option>
              {['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'].map((s) => (
                <option key={s} value={s}>
                  {enumLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('analysisData:hrvMethod')}>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="all">{tr('analysisData:allMethods')}</option>
              {['rmssd', 'sdnn', 'unknown'].map((s) => (
                <option key={s} value={s}>
                  {enumLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('analysisData:trainingStatus')}>
            <select value={training} onChange={(e) => setTraining(e.target.value)}>
              <option value="all">{tr('analysisData:allStatuses')}</option>
              {['trained', 'rest', 'unrecorded'].map((s) => (
                <option key={s} value={s}>
                  {enumLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('analysisData:requiredContextLabel')}>
            <select value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="all">{tr('analysisData:allContexts')}</option>
              {label !== 'all' && !labelOptions.some((f) => f.id === `label:${label}`) && (
                <option value={label}>
                  <Trans
                    i18nKey="analysisData:unavailableInThisDateRange"
                    components={{ slot0: <MessageValue value={label} /> }}
                  />
                </option>
              )}
              {labelOptions.map((f) => (
                <option key={f.id} value={f.id.slice(6)}>
                  {f.id.slice(6)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </details>
      <p className="small muted">
        <Trans
          i18nKey="analysisData:ofRecordedDaysSelectedAllHistoryAnalysisAcceptsUp"
          components={{
            slot0: <MessageValue value={entries.length} />,
            slot1: <MessageValue value={data.data?.entries.length ?? 0} />,
            slot2: <Link to="/analysis/metrics" />,
          }}
        />
      </p>
    </Panel>
  );
  return {
    entries,
    catalog,
    settings,
    controls,
    loading: data.loading,
    error: !valid ? tr('analysisData:chooseAValidRangeOfUpToFiveYears') : data.error,
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
  useTranslation();
  const [query, setQuery] = useState('');
  const available = catalog.filter((f) => f.id !== target),
    visible = available
      .filter((f) =>
        `${localize(f.label)} ${localize(f.group)}`.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 100);
  return (
    <details className="panel feature-picker">
      <summary>
        <Trans
          i18nKey="analysisData:chooseInputsMetricsLabelsActive"
          components={{
            slot0: (
              <MessageValue
                value={
                  selected.filter((id) => id !== target && available.some((f) => f.id === id))
                    .length
                }
              />
            ),
          }}
        />
      </summary>
      <p className="small muted">
        <Trans
          i18nKey="analysisData:selectedInputsUpTo180InputsPerAnalysis"
          components={{
            slot0: (
              <MessageValue
                value={
                  selected
                    .filter((id) => id !== target)
                    .map(
                      (id) =>
                        localize(available.find((f) => f.id === id)?.label) ||
                        tr('analysisData:unavailableExcluded', { value0: id }),
                    )
                    .join(', ') || localize('None')
                }
              />
            ),
          }}
        />
      </p>
      <div className="picker-actions">
        <button
          className="button secondary small-button"
          onClick={() => onChange(available.slice(0, 180).map((f) => f.id))}
        >
          {available.length > 180
            ? tr('analysisData:selectFirst180Inputs')
            : tr('analysisData:selectAllInputs')}
        </button>
        <button
          className="button secondary small-button"
          onClick={() => onChange(available.filter((f) => f.kind === 'numeric').map((f) => f.id))}
        >
          {tr('analysisData:numericOnly')}
        </button>
        <button className="button secondary small-button" onClick={() => onChange([])}>
          {tr('analysisData:clearInputs')}
        </button>
        <input
          aria-label={tr('analysisData:findAnInput')}
          placeholder={tr('analysisData:findAMetricOrLabel')}
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
              disabled={!selected.includes(f.id) && selected.length >= 180}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...selected, f.id] : selected.filter((id) => id !== f.id),
                )
              }
            />
            <span>
              {localize(f.label)}
              <small>
                {localize(f.group)} · {localize(f.unit)}
              </small>
            </span>
          </label>
        ))}
      </div>
      <p className="small muted">{tr('analysisData:showingUpTo100MatchingInputsSearchToFind')}</p>
    </details>
  );
}
