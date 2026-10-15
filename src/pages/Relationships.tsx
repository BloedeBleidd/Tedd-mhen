import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { featureDescription } from '../lib/feature-labels';
import { localize, t as tr } from '../i18n';
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
  useTranslation();
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
        eyebrow={tr('relationships:findConnections')}
        title={tr('relationships:whatMovesTogether')}
        description={tr('relationships:compareMeasurementsAndContextAcrossDaysAndLongerPatterns')}
      />
      {data.controls}
      <Panel>
        <div className="fields-grid three">
          <Field label={tr('relationships:outcome')}>
            <select value={target} onChange={(e) => setTarget(e.target.value as MetricKey)}>
              {Object.entries(metrics).map(([id, m]) => (
                <option key={id} value={id}>
                  {localize(m.label)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('relationships:compareWith')}>
            <select value={activePredictor} onChange={(e) => setPredictor(e.target.value)}>
              {data.catalog
                .filter((f) => lag > 0 || f.id !== target)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {localize(f.label)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={tr('relationships:outcomeOccurs')}>
            <select value={lag} onChange={(e) => setLag(Number(e.target.value))}>
              {[0, 1, 2, 3, 7, 14, 28].map((n) => (
                <option key={n} value={n}>
                  {n === 0
                    ? tr('relationships:onTheSameJournalDate')
                    : tr('relationships:calendarDayLater', {
                        count: n,
                      })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('relationships:perspective')}>
            <select value={view} onChange={(e) => setView(e.target.value as RelationshipView)}>
              <option value="daily">{tr('relationships:recordedDailyLevels')}</option>
              <option value="changes">{tr('relationships:changesFromThePreviousDay')}</option>
              <option value="detrended">{tr('relationships:removeEachLinearTimeTrend')}</option>
              <option value="week">{tr('relationships:trailing7DayNumericMeans')}</option>
              <option value="month">{tr('relationships:trailing28DayNumericMeans')}</option>
            </select>
          </Field>
          <Field label={tr('relationships:correlationMethod')}>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'pearson' | 'spearman')}
            >
              <option value="spearman">{tr('relationships:spearmanMonotonicAssociation')}</option>
              <option value="pearson">{tr('relationships:pearsonLinearAssociation')}</option>
            </select>
          </Field>
          <Field label={tr('relationships:bootstrapBlockLength')}>
            <select value={block} onChange={(e) => setBlock(Number(e.target.value))}>
              {[7, 14, 28].map((n) => (
                <option key={n} value={n}>
                  <Trans
                    i18nKey="relationships:calendarDays"
                    components={{ slot0: <MessageValue value={n} /> }}
                  />
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="small muted">
          {tr('relationships:sleepBelongsToTheWakingDateTrainingMondaySleep')}
        </p>
      </Panel>
      {!data.loading &&
        selected.some((id) => id !== target && !data.catalog.some((f) => f.id === id)) && (
          <p role="status">
            {tr('relationships:someSelectedInputsHaveNoMatchingObservationsAndAre')}
          </p>
        )}
      <FeaturePicker
        catalog={data.catalog}
        selected={selected}
        onChange={setSelected}
        target={target}
      />
      <ErrorBox message={data.error || analysis.error} />
      {(data.loading || analysis.busy) && (
        <p role="status">{tr('relationships:calculatingAlignedRelationships')}</p>
      )}
      {!data.loading && !data.entries.length && (
        <Panel>
          <p>{tr('relationships:noObservationsMatchThisSelectionTryAllRecordedDates')}</p>
          <Link className="button secondary" to="/check-in">
            {tr('relationships:addACheckIn')}
          </Link>{' '}
          <Link className="text-link" to="/import">
            {tr('relationships:importJournalData')}
          </Link>
        </Panel>
      )}
      {result && (
        <>
          <div className="analysis-stats">
            <div>
              <span className="stat-label">
                {method === 'spearman'
                  ? tr('relationships:spearman')
                  : tr('relationships:pearsonR')}
              </span>
              <strong>{number(result.selected.coefficient, 2)}</strong>
              <p>
                <Trans
                  i18nKey="relationships:alignedPairs14RequiredWithVariation"
                  components={{ slot0: <MessageValue value={result.selected.n} /> }}
                />
              </p>
            </div>
            <div>
              <span className="stat-label">
                {tr('relationships:approximate95BlockBootstrapInterval')}
              </span>
              <strong className="compact-stat">
                {result.interval
                  ? result.interval.interval.map((v) => number(v, 2)).join(tr('relationships:to'))
                  : tr('relationships:notAvailable')}
              </strong>
              <p>
                {result.interval
                  ? tr('relationships:dayBlocksReplicates', {
                      value0: result.interval.block,
                      value1: result.interval.validReplicates,
                    })
                  : tr('relationships:needs28PairsAndASpanOfAtLeast')}
              </p>
            </div>
            <div>
              <span className="stat-label">{tr('relationships:compareDefinitions')}</span>
              <strong className="compact-stat">
                <Trans
                  i18nKey="relationships:r"
                  components={{
                    slot0: <MessageValue value={number(result.selected.pearson, 2)} />,
                    slot1: <MessageValue value={number(result.selected.spearman, 2)} />,
                  }}
                />
              </strong>
              <p>{tr('relationships:linearVsRankAssociationNeitherImpliesCausation')}</p>
            </div>
          </div>
          <Panel
            title={`${localize(chosen?.label)} → ${localize(metrics[target].label)}`}
            subtitle={chosen ? featureDescription(chosen) : undefined}
          >
            <RelationshipChart
              pairs={result.pairs}
              xLabel={localize(chosen?.label) || predictor}
              yLabel={localize(metrics[target].label)}
            />
            <p className="small muted">
              {tr('relationships:anArrowSpecifiesTimeAlignmentNotCausalInfluencePoints')}
            </p>
          </Panel>
          <div className="analysis-explanation">
            <Panel
              title={tr('relationships:strongestObservedAssociations')}
              subtitle={tr('relationships:sortedByAbsoluteCoefficientForThisOutcomeLagAnd')}
            >
              <div className="association-list">
                {result.ranking.map((r) => (
                  <button
                    key={r.id}
                    className={`association-row ${r.id === predictor ? 'selected' : ''}`}
                    onClick={() => setPredictor(r.id)}
                  >
                    <span>
                      {localize(r.label)}
                      <small>
                        <Trans
                          i18nKey="relationships:pairs"
                          components={{ slot0: <MessageValue value={r.n} /> }}
                        />
                      </small>
                    </span>
                    <span className="association-bar">
                      <i style={{ width: `${Math.abs(r.coefficient ?? 0) * 100}%` }} />
                    </span>
                    <strong>{number(r.coefficient, 2)}</strong>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title={tr('relationships:doesTheTimingChangeThePattern')}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{tr('relationships:outcomeLaterBy')}</th>
                      <th>{method === 'pearson' ? 'r' : 'ρ'}</th>
                      <th>{tr('relationships:pairs2')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lagProfile.map((row) => (
                      <tr key={row.lag}>
                        <td>
                          <button className="text-link" onClick={() => setLag(row.lag)}>
                            <Trans
                              i18nKey="relationships:days"
                              components={{ slot0: <MessageValue value={row.lag} /> }}
                            />
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
                {tr('relationships:scanningManyMetricsLagsAndFiltersMakesLargeChance')}
              </p>
            </Panel>
          </div>
          <Panel title={tr('relationships:reproduceThisResult')}>
            <p>{tr('relationships:missingPairsAreExcludedGapsAreNeverCompressedThe')}</p>
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
              {tr('relationships:downloadRelationshipAnalysis')}
            </button>
          </Panel>
        </>
      )}
    </>
  );
}
