import { MethodSources } from '../components/MethodSources';
import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { enumLabel, localize, t as tr } from '../i18n';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
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
  useTranslation();
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
        eyebrow={tr('analysis:followTheEvidence')}
        title={tr('analysis:aPatternOrJustADay')}
        description={tr('analysis:exploreYourTrajectoryWithRoomForUncertainty')}
        action={<HelpLink />}
      />
      <Panel className="filter-panel">
        <div className="analysis-filters">
          <Field label={tr('analysis:whatWouldYouLikeToUnderstand')}>
            <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
              {Object.entries(metrics).map(([k, m]) => (
                <option key={k} value={k}>
                  {localize(m.label)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('analysis:from')}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={tr('analysis:to')}>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={tr('analysis:forecastHorizon')}>
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              <option value="0">{tr('analysis:noForecast')}</option>
              <option value="3">{tr('analysis:3Days')}</option>
              <option value="7">{tr('analysis:7Days')}</option>
              {[14, 28].map((n) => (
                <option key={n} value={n}>
                  {tr('prediction:calendarDayAhead', { count: n })}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="quick-ranges">
          {[28, 90, 365].map((days) => (
            <button
              key={days}
              onClick={() => {
                setFrom(shiftDate(localDate(), -(days - 1)));
                setTo(localDate());
              }}
            >
              <Trans
                i18nKey="analysis:lastDays"
                components={{ slot0: <MessageValue value={days} /> }}
              />
            </button>
          ))}
          <button
            onClick={() => {
              setIllness('all');
              setSource('all');
              setMethod('all');
            }}
          >
            {tr('analysis:clearObservationFilters')}
          </button>
        </div>
        <details className="analysis-options">
          <summary>
            <Trans
              i18nKey="analysis:modelSettingsDataSelectionFiltersActive"
              components={{
                slot0: (
                  <MessageValue
                    value={
                      [illness, source, ...(metric === 'hrv' ? [method] : [])].filter(
                        (value) => value !== 'all',
                      ).length
                    }
                  />
                ),
              }}
            />
          </summary>
          <div className="fields-grid three">
            <Field label={tr('analysis:priorOnTheWeeklySlope')}>
              <select value={prior} onChange={(e) => setPrior(e.target.value as Prior)}>
                <option value="weak">{tr('analysis:weakShrinkage')}</option>
                <option value="regular">{tr('analysis:regularShrinkage')}</option>
                <option value="strong">{tr('analysis:strongShrinkage')}</option>
              </select>
            </Field>
            <Field label={tr('analysis:illnessSelection')}>
              <select value={illness} onChange={(e) => setIllness(e.target.value)}>
                <option value="all">{tr('analysis:allDaysIncludingUnknown')}</option>
                <option value="no">{tr('analysis:onlyExplicitlyIllnessFreeDays')}</option>
                <option value="yes">{tr('analysis:onlyIllnessSymptomDays')}</option>
              </select>
            </Field>
            <Field label={tr('analysis:measurementSource')}>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="all">{tr('analysis:allSources')}</option>
                {['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'].map((s) => (
                  <option key={s} value={s}>
                    {enumLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
            {metric === 'hrv' && (
              <Field label={tr('analysis:hrvMethod')}>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="all">{tr('analysis:allMethods')}</option>
                  <option value="rmssd">{tr('analysis:rmssdOnly')}</option>
                  <option value="sdnn">{tr('analysis:sdnnOnly')}</option>
                  <option value="unknown">{tr('analysis:unknownMethodOnly')}</option>
                </select>
              </Field>
            )}
          </div>
          <p className="muted small">
            {tr('analysis:priorsShrinkTheWeeklySlopeTowardZeroCompareSettings')}
          </p>
        </details>
      </Panel>
      <ErrorBox message={!valid ? tr('analysis:selectAValidDateRangeOfUpToFive') : error} />
      {loading ? (
        <Loading />
      ) : (
        valid &&
        !error && (
          <MessageValue
            value={
              model ? (
                <>
                  <div className="analysis-stats">
                    <div>
                      <span className="stat-label">{tr('analysis:recordedObservations')}</span>
                      <strong>
                        {model.n}
                        <small>
                          <Trans
                            i18nKey="analysis:days"
                            components={{ slot0: <>{selectedDays}</> }}
                          />
                        </small>
                      </strong>
                      <p>
                        <Trans
                          i18nKey="analysis:daysMissingOrExcluded"
                          components={{ slot0: <>{selectedDays - observedDays.size}</> }}
                        />
                      </p>
                    </div>
                    <div>
                      <span className="stat-label">{tr('analysis:estimatedWeeklyChange')}</span>
                      <strong>
                        {model.slope >= 0 ? '+' : ''}
                        {number(model.slope, 2)}
                        <small> {localize(spec.unit)}</small>
                      </strong>
                      <p>
                        <Trans
                          i18nKey="analysis:95CriTo"
                          components={{
                            slot0: <>{number(model.slopeInterval[0], 2)}</>,
                            slot1: <>{number(model.slopeInterval[1], 2)}</>,
                          }}
                        />
                      </p>
                    </div>
                    <div>
                      <span className="stat-label">
                        {tr('analysis:probabilityOfAnIncreasingTrend')}
                      </span>
                      <strong>
                        {number(model.probabilityIncreasing * 100)}
                        <small>%</small>
                        {model.slope >= 0 ? (
                          <ArrowUpRight size={24} />
                        ) : (
                          <ArrowDownRight size={24} />
                        )}
                      </strong>
                      <p>{tr('analysis:conditionalOnThisModelAndPrior')}</p>
                    </div>
                  </div>
                  <Panel
                    title={tr('analysis:withPerspective', { value0: localize(spec.label) })}
                    subtitle={`${prettyDate(model.firstDate)} – ${prettyDate(model.lastDate)} · ${horizon ? tr('analysis:dayExtrapolationFromTheLastObservation', { value0: horizon }) : tr('analysis:observedPeriodOnly')}`}
                    action={<span className="tag">{tr('analysis:bayesianLinearTrend')}</span>}
                  >
                    {horizon > 7 && <p className="notice">{tr('analysisTools:longHorizon')}</p>}
                    <TrendChart
                      data={model.curve}
                      forecastStart={horizon ? model.lastDate : undefined}
                      unit={localize(spec.unit)}
                    />
                    <div className="chart-legend">
                      <span>
                        <Trans
                          i18nKey="analysis:observed"
                          components={{ slot0: <i className="legend-dot" /> }}
                        />
                      </span>
                      <span>
                        <Trans
                          i18nKey="analysis:posteriorMean"
                          components={{ slot0: <i className="legend-line" /> }}
                        />
                      </span>
                      <span>
                        <Trans
                          i18nKey="analysis:95CredibleInterval"
                          components={{ slot0: <i className="legend-area credible" /> }}
                        />
                      </span>
                      <span>
                        <Trans
                          i18nKey="analysis:95PredictiveInterval"
                          components={{ slot0: <i className="legend-area" /> }}
                        />
                      </span>
                    </div>
                  </Panel>
                  <MethodSources ids={['bayes', 'forecasting']} />
                  <div className="analysis-explanation">
                    <Panel title={tr('analysis:whatThisSuggests')}>
                      <p className="finding">
                        {model.slopeInterval[0] > 0
                          ? tr('analysis:theModelSupportsAnIncreasingTrendInThisWindow')
                          : model.slopeInterval[1] < 0
                            ? tr('analysis:theModelSupportsADecreasingTrendInThisWindow')
                            : tr('analysis:theDirectionIsStillUncertainInThisWindow')}
                      </p>
                      <p className="muted">
                        {tr('analysis:increasingIsADirectionNotAJudgmentOfHealth')}
                      </p>
                      {horizon > 0 && last && (
                        <div className="forecast-result">
                          <span>
                            <Trans
                              i18nKey="analysis:for"
                              components={{
                                slot0: (
                                  <>
                                    {prettyDate(last.date, {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric',
                                    })}
                                  </>
                                ),
                              }}
                            />
                          </span>
                          <strong>
                            {number(last.mean, 2)} <small>{localize(spec.unit)}</small>
                          </strong>
                          <span>
                            <Trans
                              i18nKey="analysis:singleObservation95PredictiveInterval"
                              components={{
                                slot0: <br />,
                                slot1: <b />,
                                slot2: <>{number(last.predictive[0], 2)}</>,
                                slot3: <>{number(last.predictive[1], 2)}</>,
                                slot4: <>{localize(spec.unit)}</>,
                              }}
                            />
                          </span>
                        </div>
                      )}
                    </Panel>
                    <Panel title={tr('analysis:beforeYouDrawAConclusion')}>
                      <ul className="insight-list">
                        <li>
                          <Info size={16} />
                          <span>
                            {tr('analysis:theDarkerBandDescribesUncertaintyAboutTheAverageTrend')}
                          </span>
                        </li>
                        <li>
                          <Info size={16} />
                          <span>
                            {model.residualAutocorrelation !== null
                              ? tr('analysis:consecutiveDayResidualCorrelationPairs', {
                                  value0: number(model.residualAutocorrelation, 2),
                                  value1: model.residualPairs,
                                  value2:
                                    Math.abs(model.residualAutocorrelation) > 0.3
                                      ? tr('analysis:dependenceMayMakeTheseIntervalsTooNarrow')
                                      : tr('analysis:thisDiagnosticDoesNotEstablishIndependence'),
                                })
                              : tr('analysis:tooFewConsecutiveDayResidualPairsToAssessSerial')}
                          </span>
                        </li>
                        {model.boundaryWarning && (
                          <li>
                            <Info size={16} />
                            <span>
                              {tr('analysis:theGaussianModelExtendsBeyondThisMetricSPhysical')}
                            </span>
                          </li>
                        )}
                        {metric === 'hrv' && (methods.size > 1 || methods.has('unknown')) && (
                          <li>
                            <Info size={16} />
                            <span>{tr('analysis:hrvMethodsAreMixedOrUnknownSelectOneKnown')}</span>
                          </li>
                        )}
                        {sources.size > 1 && (
                          <li>
                            <Info size={16} />
                            <span>
                              {tr(
                                'analysis:thisSelectionMixesMeasurementSourcesDeviceChangesCanResemble',
                              )}
                            </span>
                          </li>
                        )}
                        {to > model.lastDate && (
                          <li>
                            <Info size={16} />
                            <span>
                              <Trans
                                i18nKey="analysis:theLastObservationIsForecastDatesAreBasedOn"
                                components={{ slot0: <>{model.lastDate}</> }}
                              />
                            </span>
                          </li>
                        )}
                        <li>
                          <Info size={16} />
                          <span>
                            {tr('analysis:missingnessAndIllnessFilteringCanBiasTheSampleFourteen')}
                          </span>
                        </li>
                      </ul>
                    </Panel>
                  </div>
                  <details className="panel model-details">
                    <summary>{tr('analysis:modelSpecificationValuesReproducibility')}</summary>
                    <p>
                      <Trans
                        i18nKey="analysis:yInterceptSlopeCenteredElapsedWeeksGaussianNoiseFixed"
                        components={{
                          slot0: <>{model.prior.center}</>,
                          slot1: <>{model.prior.scale}</>,
                          slot2: <>{model.prior.slopeVariance}</>,
                          slot3: <>{model.posterior.df}</>,
                        }}
                      />
                    </p>
                    <button
                      className="button secondary small-button"
                      onClick={() =>
                        download(
                          JSON.stringify(
                            {
                              synthetic: demo,
                              settings: {
                                metric,
                                from,
                                to,
                                prior,
                                horizon,
                                illness,
                                method,
                                source,
                              },
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
                      <Trans
                        i18nKey="analysis:downloadModelObservations"
                        components={{ slot0: <Download size={15} /> }}
                      />
                    </button>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{tr('analysis:date')}</th>
                            <th>{tr('analysis:observed2')}</th>
                            <th>{tr('analysis:mean')}</th>
                            <th>{tr('analysis:95CredibleInterval2')}</th>
                            <th>{tr('analysis:95PredictiveInterval2')}</th>
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
                    title={tr('analysis:letTheEvidenceBuild')}
                    description={tr('analysis:ofRequiredObservationsForRecordMoreDaysOrWiden', {
                      value0: observations.length,
                      value1: MIN_OBSERVATIONS,
                      value2: localize(spec.label),
                    })}
                    action={false}
                  />
                  <Link className="button secondary" to="/check-in">
                    {tr('analysis:addACheckIn')}
                  </Link>{' '}
                  <Link className="text-link" to="/import">
                    {tr('analysis:importJournalData')}
                  </Link>
                </Panel>
              )
            }
          />
        )
      )}
      <p className="data-caption">
        {tr('analysis:exploratoryStatisticsNotADiagnosticOrValidatedForecastingSystem')}
      </p>
    </>
  );
}
