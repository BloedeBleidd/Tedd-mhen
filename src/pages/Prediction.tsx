import { MethodSources } from '../components/MethodSources';
import { numberRange } from '../components/ui';
import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { localize, t as tr } from '../i18n';
import { localDate } from '../../shared/schema';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { useMemo, useState } from 'react';
import { metrics, type MetricKey } from '../../shared/metrics';
import { fitMultivariable, type ModelSettings } from '../../shared/multivariable';
import type { Prior } from '../../shared/bayes';
import { useAnalysis } from '../lib/use-analysis';
import { useApi, download } from '../lib/api';
import { FeaturePicker, useAnalysisData } from '../components/AnalysisData';
import { TrendChart } from '../components/Charts';
import { ErrorBox, Field, PageHeading, Panel, number } from '../components/ui';
export function Prediction() {
  useTranslation();
  const { demo } = useApi();
  const data = useAnalysisData();
  const [target, setTarget] = useState<MetricKey>('wellbeing'),
    [features, setFeatures] = useState(['sleepHours', 'trainingLoad', 'stress', 'trained']),
    [horizon, setHorizon] = useState(1),
    [window, setWindow] = useState(1),
    [prior, setPrior] = useState<Prior>('regular'),
    [history, setHistory] = useState(true),
    [time, setTime] = useState(true);
  const activeInputs = useMemo(
    () => features.filter((id) => id !== target && data.catalog.some((f) => f.id === id)),
    [features, target, data.catalog],
  );
  const settings = useMemo<ModelSettings>(
    () => ({ target, features: activeInputs, horizon, window, prior, history, time }),
    [target, activeInputs, horizon, window, prior, history, time],
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
    spec = metrics[target],
    errorUnit =
      spec.unit === '/ 10' || spec.unit === '/ 100' ? localize('points') : localize(spec.unit);
  return (
    <>
      <PageHeading
        eyebrow={tr('prediction:manySignalsOneOutcome')}
        title={tr('prediction:putYourObservationsTogether')}
        description={tr('prediction:aBayesianModelUsingMultipleMeasuredSeriesAndRecorded')}
        action={
          result ? (
            <a className="button secondary" href="#analysis-results">
              {tr('analysisTools:viewResults')}
            </a>
          ) : undefined
        }
      />
      {data.controls}
      <Panel>
        <div className="fields-grid three">
          <Field label={tr('prediction:predictAnOutcome')}>
            <select value={target} onChange={(e) => setTarget(e.target.value as MetricKey)}>
              {Object.entries(metrics).map(([id, m]) => (
                <option key={id} value={id}>
                  {localize(m.label)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('prediction:predictionTiming')}>
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              <option value={0}>{tr('prediction:sameDayConditionalEstimate')}</option>
              {[1, 3, 7, 14, 28].map((n) => (
                <option key={n} value={n}>
                  {tr('prediction:calendarDayAhead', { count: n })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('prediction:numericPredictorHistory')}>
            <select value={window} onChange={(e) => setWindow(Number(e.target.value))}>
              <option value={1}>{tr('prediction:atTheForecastOrigin')}</option>
              <option value={7}>{tr('prediction:previous7DaysIncludingOrigin')}</option>
              <option value={28}>{tr('prediction:previous28DaysIncludingOrigin')}</option>
            </select>
          </Field>
          <Field label={tr('prediction:coefficientPrior')}>
            <select value={prior} onChange={(e) => setPrior(e.target.value as Prior)}>
              <option value="weak">{tr('prediction:weakShrinkage')}</option>
              <option value="regular">{tr('prediction:regularShrinkage')}</option>
              <option value="strong">{tr('prediction:strongShrinkage')}</option>
            </select>
          </Field>
          <label className="check-label">
            <Trans
              i18nKey="prediction:includeOutcomeHistory"
              components={{
                slot0: (
                  <input
                    type="checkbox"
                    checked={history}
                    onChange={(e) => setHistory(e.target.checked)}
                  />
                ),
              }}
            />
          </label>
          <label className="check-label">
            <Trans
              i18nKey="prediction:adjustForLinearCalendarTrend"
              components={{
                slot0: (
                  <input
                    type="checkbox"
                    checked={time}
                    onChange={(e) => setTime(e.target.checked)}
                  />
                ),
              }}
            />
          </label>
        </div>
        <p className="small muted">
          <Trans
            i18nKey="prediction:eachRowPredictsOutcomeOnDayDFromObservations"
            components={{ slot0: <MessageValue value={horizon} /> }}
          />
        </p>
      </Panel>
      {horizon > 7 && <p className="notice">{tr('analysisTools:longHorizon')}</p>}
      {!data.loading &&
        features.some((id) => id !== target && !data.catalog.some((f) => f.id === id)) && (
          <p role="status">{tr('prediction:someSelectedInputsHaveNoMatchingObservationsAndAre')}</p>
        )}
      <FeaturePicker
        catalog={data.catalog}
        selected={features}
        onChange={setFeatures}
        target={target}
      />
      <ErrorBox message={data.error || analysis.error} />
      {(data.loading || analysis.busy) && (
        <p role="status">{tr('prediction:fittingTheBayesianModelAndTemporalHoldout')}</p>
      )}
      {!data.loading && !data.entries.length && (
        <Panel>
          <p>{tr('prediction:noObservationsMatchThisSelectionTryAllRecordedDates')}</p>
          <Link className="button secondary" to="/check-in">
            {tr('prediction:addACheckIn')}
          </Link>{' '}
          <Link className="text-link" to="/import">
            {tr('prediction:importJournalData')}
          </Link>
        </Panel>
      )}
      {result && (
        <>
          <div className="analysis-stats" id="analysis-results" tabIndex={-1}>
            <div>
              <span className="stat-label">{tr('prediction:completeModelRows')}</span>
              <strong>
                {result.n}
                <small> / {result.observed}</small>
              </strong>
              <p>
                <Trans
                  i18nKey="prediction:excludedForMissingInputs"
                  components={{ slot0: <MessageValue value={result.excluded} /> }}
                />
              </p>
            </div>
            <div>
              <span className="stat-label">{tr('prediction:activePredictors')}</span>
              <strong>
                {result.active}
                <small> / {result.selected}</small>
              </strong>
              <p>
                <Trans
                  i18nKey="prediction:plusIntercept"
                  components={{
                    slot0: <MessageValue value={time ? tr('prediction:andCalendarTrend') : ''} />,
                  }}
                />
              </p>
            </div>
            <div>
              <span className="stat-label">{tr('prediction:requiredObservations')}</span>
              <strong>{result.minimum}</strong>
              <p>{tr('prediction:aDisplayThresholdNotEvidenceOfValidity')}</p>
            </div>
          </div>
          {!result.ready && (
            <Panel>
              <p role="status">{localize(result.reason)}</p>
            </Panel>
          )}
          {result.dropped.length > 0 && (
            <details className="panel model-details">
              <summary>
                <Trans
                  i18nKey="prediction:inputsNotUsed"
                  components={{ slot0: <MessageValue value={result.dropped.length} /> }}
                />
              </summary>
              <ul>
                {result.dropped.map((d) => (
                  <li key={d.id}>
                    <strong>{localize(d.label)}:</strong> {localize(d.reason)}
                  </li>
                ))}
              </ul>
              <p>{tr('prediction:screeningUsesTheTrainingPeriodWhenThereIsEnough')}</p>
            </details>
          )}
        </>
      )}
      {model && (
        <>
          <Panel
            title={tr('prediction:conditionalPrediction')}
            subtitle={tr('prediction:usesTheLatestRecordedPredictorDateNotAnAssumed')}
          >
            {model.future ? (
              <>
                <div className="forecast-result">
                  <span>
                    {model.future.origin} → {model.future.date}
                    {model.future.observed !== null ? tr('prediction:outcomeAlreadyObserved') : ''}
                  </span>
                  <strong>
                    {number(model.future.mean, 2)} <small>{localize(spec.unit)}</small>
                  </strong>
                  <span>
                    <Trans
                      i18nKey="prediction:95PredictiveInterval"
                      components={{
                        slot0: <b />,
                        slot1: <MessageValue value={numberRange(model.future.predictive)} />,
                        slot2: <MessageValue value={localize(spec.unit)} />,
                      }}
                    />
                  </span>
                </div>
                <details>
                  <summary>{tr('prediction:inputsBehindThisPrediction')}</summary>
                  <ul>
                    {model.future.inputs.map((input) => (
                      <li key={input.id}>
                        {localize(input.label)}: {number(input.value, 2)}
                        {input.outsideRange ? tr('prediction:outsideTheFittedInputRange') : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <p>{tr('prediction:theLatestRecordedDayLacksOneOrMoreActive')}</p>
            )}
            <p className="small muted">
              <Trans
                i18nKey="prediction:predictionConditionsOnRecordedInputsTheirMeasurementErrorIs"
                components={{
                  slot0: (
                    <MessageValue
                      value={
                        model.future && model.future.origin < localDate()
                          ? tr('prediction:theLatestPredictorDateIsThisIsNotA', {
                              value0: model.future.origin,
                            })
                          : ''
                      }
                    />
                  ),
                }}
              />
            </p>
          </Panel>
          <div className="analysis-chart-grid">
            <Panel
              title={tr('prediction:modelFitAndUncertainty')}
              subtitle={tr('prediction:descriptiveFitOnAllCompleteSelectedRowsForecastPerformance')}
            >
              <TrendChart
                data={[...model.curve, ...(model.future?.forecast ? [model.future] : [])]}
                unit={localize(spec.unit)}
                forecastStart={model.future?.forecast ? model.curve.at(-1)?.date : undefined}
              />
              <div className="chart-legend">
                <span>{tr('prediction:pointsObserved')}</span>
                <span>{tr('prediction:linePosteriorMean')}</span>
                <span>{tr('prediction:darkBand95CredibleInterval')}</span>
                <span>{tr('prediction:lightBand95PredictiveInterval')}</span>
              </div>
            </Panel>
            <Panel
              title={tr('analysisTools:holdoutTitle')}
              subtitle={tr('prediction:last20OfOutcomeDatesHeldOutTrainingOutcomes')}
            >
              {model.validation ? (
                <>
                  <TrendChart
                    data={model.validation.predictions}
                    unit={localize(spec.unit)}
                    validation
                  />
                  <p className="small muted">{tr('analysisTools:validationLegend')}</p>
                </>
              ) : (
                <p>{localize(model.validationUnavailableReason)}</p>
              )}
            </Panel>
          </div>
          <Panel
            title={tr('prediction:doesItPredictLaterObservations')}
            subtitle={tr('prediction:last20OfOutcomeDatesHeldOutTrainingOutcomes')}
          >
            {model.validation ? (
              <>
                <div className="analysis-stats">
                  <div>
                    <span className="stat-label">{tr('prediction:heldOutMae')}</span>
                    <strong>
                      {number(model.validation.mae, 2)}
                      <small> {localize(spec.unit)}</small>
                    </strong>
                    <p>
                      <Trans
                        i18nKey="prediction:predictionsTrainingRows"
                        components={{
                          slot0: <MessageValue value={model.validation.n} />,
                          slot1: <MessageValue value={model.validation.trainN} />,
                        }}
                      />
                    </p>
                  </div>
                  <div>
                    <span className="stat-label">{tr('prediction:persistenceBaselineMae')}</span>
                    <strong>{number(model.validation.persistenceMae, 2)}</strong>
                    <p>
                      <Trans
                        i18nKey="prediction:pairedRowsPredictsTheLastKnownOutcome"
                        components={{
                          slot0: <MessageValue value={model.validation.persistenceN} />,
                        }}
                      />
                    </p>
                  </div>
                  <div>
                    <span className="stat-label">{tr('prediction:95IntervalCoverage')}</span>
                    <strong>
                      {number(model.validation.coverage * 100)}
                      <small>%</small>
                    </strong>
                    <p>{tr('prediction:observedCoverageInThisSmallHoldoutNotACalibration')}</p>
                  </div>
                </div>
                <p>
                  <Trans
                    i18nKey="prediction:rmseModelMaeOnTheSamePersistenceRowsTraining"
                    components={{
                      slot0: <MessageValue value={number(model.validation.rmse, 2)} />,
                      slot1: <MessageValue value={number(model.validation.matchedModelMae, 2)} />,
                      slot2: <MessageValue value={number(model.validation.meanBaselineMae, 2)} />,
                      slot3: <MessageValue value={model.validation.lastTrainingOutcome} />,
                      slot4: <MessageValue value={model.validation.firstValidationOrigin} />,
                      slot5: <MessageValue value={model.validation.excluded} />,
                    }}
                  />
                </p>
                <dl className="evaluation-metrics">
                  <div>
                    <dt>{tr('analysisTools:intervalScore')}</dt>
                    <dd>
                      {number(model.validation.evaluation.intervalScore, 2)} {errorUnit}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr('analysisTools:meanWidth')}</dt>
                    <dd>
                      {number(model.validation.evaluation.meanWidth, 2)} {errorUnit}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr('analysisTools:bias')}</dt>
                    <dd>
                      {number(model.validation.evaluation.bias, 2)} {errorUnit}
                    </dd>
                  </div>
                </dl>
                <p className="small muted">{tr('analysisTools:scoreExplanation')}</p>
                <p className="small muted">{tr('analysisTools:biasExplanation')}</p>
                <details>
                  <summary>{tr('prediction:heldOutPredictions')}</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{tr('prediction:date')}</th>
                          <th>{tr('prediction:observed')}</th>
                          <th>{tr('prediction:predicted')}</th>
                          <th>{tr('prediction:95PredictiveInterval2')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.validation.predictions.map((p) => (
                          <tr key={p.date}>
                            <td>{p.date}</td>
                            <td>{number(p.observed, 2)}</td>
                            <td>{number(p.mean, 2)}</td>
                            <td>{numberRange(p.predictive)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <p>{localize(model.validationUnavailableReason)}</p>
            )}
            <p className="small muted">
              {tr('prediction:repeatedlyChoosingInputsAfterViewingThisScoreTunesTo')}
            </p>
          </Panel>
          <MethodSources ids={['bayes', 'intervalScore', 'validation']} />
          <Panel
            title={tr('prediction:conditionalAssociations')}
            subtitle={tr('prediction:sortedByAbsolutePredictedChangeForOneObservedStandard')}
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{tr('prediction:input')}</th>
                    <th>{tr('prediction:changePer1Sd')}</th>
                    <th>{tr('prediction:changePerUnitLabel01')}</th>
                    <th>{tr('prediction:95CredibleIntervalPerUnit')}</th>
                    <th>{tr('prediction:pCoefficientGt0')}</th>
                  </tr>
                </thead>
                <tbody>
                  {model.coefficients.map((c) => (
                    <tr key={c.id}>
                      <td>{localize(c.label)}</td>
                      <td>{number(c.typicalChange, 2)}</td>
                      <td>{number(c.value, 2)}</td>
                      <td>{numberRange(c.interval)}</td>
                      <td>{number(c.probabilityPositive * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">
              <Trans
                i18nKey="prediction:allChangesAreInUnitsThisIsAConditional"
                components={{
                  slot0: <MessageValue value={localize(spec.label)} />,
                  slot1: <MessageValue value={localize(spec.unit)} />,
                }}
              />
            </p>
          </Panel>
          <Panel title={tr('prediction:modelChecksAndLimits')}>
            <ul>
              <li>
                <Trans
                  i18nKey="prediction:pairsOfInputsHaveRGt095"
                  components={{
                    slot0: <MessageValue value={model.collinear.length} />,
                    slot1: (
                      <MessageValue
                        value={
                          model.collinear.length > 0
                            ? tr('prediction:theirSeparateContributionsAreDifficultToIdentify')
                            : ''
                        }
                      />
                    ),
                  }}
                />
              </li>
              <li>
                <Trans
                  i18nKey="prediction:consecutiveDayResidualCorrelationPairsSerialDependenceIsNot"
                  components={{
                    slot0: <MessageValue value={number(model.residualCorrelation, 2)} />,
                    slot1: <MessageValue value={model.residualPairs} />,
                  }}
                />
              </li>
              <li>
                {model.boundaryWarning
                  ? tr('prediction:somePredictiveIntervalsExtendBeyondTheMetricSInput')
                  : tr('prediction:intervalsAreUnboundedGaussianModelQuantitiesTheyAreNot')}
              </li>
              <li>{tr('prediction:allSourceAllMethodSelectionsCanMixIncomparableMeasurements')}</li>
              <li>{tr('prediction:sameDaySymptomsAndRatingsMayDescribeTheSame')}</li>
            </ul>
          </Panel>
          <Panel title={tr('prediction:modelSpecificationReproducibility')}>
            <p>
              <Trans
                i18nKey="prediction:normalInverseGammaMultivariableRegressionProperShrinkagePriorsExact"
                components={{ slot0: <MessageValue value={model.priorVariance[1]} /> }}
              />
            </p>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  JSON.stringify({ ...model, synthetic: demo, selection: data.settings }, null, 2),
                  'teddmhen-multivariable-model.json',
                  'application/json',
                )
              }
            >
              {tr('prediction:downloadModelDesignValidation')}
            </button>
            <p className="small muted">
              {tr('prediction:thisFileIncludesPersonalObservationsAndModelInputsOne')}
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
