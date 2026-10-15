import { useTranslation } from 'react-i18next';
import { localize, t as tr } from '../i18n';
import { featureDescription } from '../lib/feature-labels';
import { useState } from 'react';
import { featureCatalog, references } from '../../shared/features';
import { Field, PageHeading, Panel } from '../components/ui';
export function MetricsGuide() {
  useTranslation();
  const [query, setQuery] = useState('');
  const catalog = featureCatalog().filter((f) =>
    `${localize(f.label)} ${featureDescription(f)} ${localize(f.group)}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow={tr('metricsGuide:definitionsMethods')}
        title={tr('metricsGuide:knowWhatTheNumbersMean')}
        description={tr(
          'metricsGuide:recordedMeasurementsTransparentTransformationsAndTheMathematicsBehindEach',
        )}
      />
      <Panel title={tr('metricsGuide:readingARelationship')}>
        <dl className="method-glossary">
          <dt>{tr('metricsGuide:pearsonR')}</dt>
          <dd>{tr('metricsGuide:centeredCrossProductDividedByTheProductOfCentered')}</dd>
          <dt>{tr('metricsGuide:spearman')}</dt>
          <dd>
            {tr('metricsGuide:pearsonCorrelationOfAverageRanksIncludingTiedRatingsDescribes')}
          </dd>
          <dt>{tr('metricsGuide:dayToDayChange')}</dt>
          <dd>{tr('metricsGuide:xDXD1OnlyWhenBothActual')}</dd>
          <dt>{tr('metricsGuide:detrendedAssociation')}</dt>
          <dd>{tr('metricsGuide:fitEachAlignedVariableToAnInterceptAndElapsed')}</dd>
          <dt>{tr('metricsGuide:trailingMeans')}</dt>
          <dd>{tr('metricsGuide:arithmeticMeanOfAll7Or28CalendarDays')}</dd>
          <dt>{tr('metricsGuide:lag')}</dt>
          <dd>{tr('metricsGuide:aPredictorOnDateDIsPairedWithAn')}</dd>
          <dt>{tr('metricsGuide:blockBootstrapInterval')}</dt>
          <dd>
            {tr('metricsGuide:resampleContiguousCalendarBlocksPreservingWithinBlockPairsAnd')}
          </dd>
          <dt>{tr('metricsGuide:bayesianConditionalCoefficient')}</dt>
          <dd>{tr('metricsGuide:theModeledOutcomeDifferenceForAOneUnitInput')}</dd>
          <dt>{tr('metricsGuide:maeRmseAndIntervalCoverage')}</dt>
          <dd>{tr('metricsGuide:meanAbsolutePredictionErrorSquareRootOfMeanSquared')}</dd>
        </dl>
      </Panel>
      <Panel
        title={tr('metricsGuide:metricAndLabelDictionary')}
        subtitle={tr('metricsGuide:builtInNumericAndCategoricalInputsPlusYourReusable', {
          value0: featureCatalog().length,
        })}
      >
        <Field label={tr('metricsGuide:findADefinition')}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('metricsGuide:sleepEffortHrvSymptom')}
          />
        </Field>
        <div className="definition-grid">
          {catalog.map((f) => (
            <article key={f.id}>
              <span className="eyebrow">{localize(f.group)}</span>
              <h3>
                {localize(f.label)} <small>{localize(f.unit)}</small>
              </h3>
              <p>{featureDescription(f)}</p>
              {f.reference && (
                <a
                  className="text-link"
                  href={references[f.reference].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {localize(references[f.reference].title)}
                </a>
              )}
            </article>
          ))}
        </div>
      </Panel>
      <Panel title={tr('metricsGuide:scopeOfTheEvidence')}>
        <p>{tr('metricsGuide:publishedMethodsExplainTheMathematicsAndMeasurementConceptsThey')}</p>
        <ul>
          {Object.values(references).map((r) => (
            <li key={r.url}>
              <a className="text-link" href={r.url} target="_blank" rel="noreferrer">
                {localize(r.title)}
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
