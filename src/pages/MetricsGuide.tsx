import { MathGuide } from '../components/MathGuide';
import { activityGroups, type Activity } from '../../shared/activities';
import { searchText } from '../lib/search-text';
import { WorkspaceLink } from '../components/WorkspaceLink';
import { useTranslation } from 'react-i18next';
import { localize, t as tr } from '../i18n';
import { featureDescription } from '../lib/feature-labels';
import { useState } from 'react';
import { featureCatalog, references } from '../../shared/features';
import { Field, PageHeading, Panel } from '../components/ui';
export function MetricsGuide() {
  useTranslation();
  const [query, setQuery] = useState('');
  const groupName = (f: ReturnType<typeof featureCatalog>[number]) =>
    f.id.startsWith('activity:')
      ? tr(`activityPicker:${activityGroups[f.id.slice(9) as Activity]}`)
      : f.group === 'Sleep' || f.group === 'Sleep timing'
        ? tr('personalization:sleep')
        : localize(f.group);
  const catalog = featureCatalog().filter((f) =>
    searchText(`${localize(f.label)} ${featureDescription(f)} ${groupName(f)}`).includes(
      searchText(query),
    ),
  );
  const groups = [...new Set(catalog.filter((f) => !f.id.startsWith('activity:')).map(groupName))];
  const sports = catalog.filter((f) => f.id.startsWith('activity:'));
  const sportGroups = [...new Set(sports.map(groupName))];
  const definitions = (features: typeof catalog) => (
    <div className="definition-grid">
      {features.map((f) => (
        <article key={f.id}>
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
        <p className="small muted">{tr('mathGuide:dictionaryHelp')}</p>
        {catalog.length === 0 && <p role="status">{tr('mathGuide:noMatches')}</p>}
        {groups.map((group) => (
          <details className="definition-group" key={`${group}:${query}`} open={!!query.trim()}>
            <summary>
              {tr('mathGuide:groupCount', {
                group,
                count: catalog.filter(
                  (f) => !f.id.startsWith('activity:') && groupName(f) === group,
                ).length,
              })}
            </summary>
            {definitions(
              catalog.filter((f) => !f.id.startsWith('activity:') && groupName(f) === group),
            )}
          </details>
        ))}
        {sports.length > 0 && (
          <details className="definition-group" key={`sports:${query}`} open={!!query.trim()}>
            <summary>
              {tr('mathGuide:groupCount', { group: tr('mathGuide:sports'), count: sports.length })}
            </summary>
            {sportGroups.map((group) => (
              <details
                className="definition-subgroup"
                key={`${group}:${query}`}
                open={!!query.trim()}
              >
                <summary>
                  {tr('mathGuide:groupCount', {
                    group,
                    count: sports.filter((f) => groupName(f) === group).length,
                  })}
                </summary>
                {definitions(sports.filter((f) => groupName(f) === group))}
              </details>
            ))}
          </details>
        )}
      </Panel>
      <Panel title={tr('habits:title')}>
        <details className="method-topic">
          <summary>{tr('mathGuide:habitsGuide')}</summary>
          <p>{tr('habits:guide')}</p>
          <p>{tr('habits:reviewGuide')}</p>
        </details>
        <WorkspaceLink className="text-link" to="/check-in#habits">
          {tr('habits:openCheckIn')}
        </WorkspaceLink>
      </Panel>
      <MathGuide />
      <Panel title={tr('metricsGuide:readingARelationship')}>
        <details className="method-topic">
          <summary>{tr('mathGuide:glossary')}</summary>
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
            <dt>{tr('analysisTools:intervalScore')}</dt>
            <dd>{tr('analysisTools:scoreExplanation')}</dd>
            <dt>{tr('analysisTools:bias')}</dt>
            <dd>{tr('analysisTools:biasExplanation')}</dd>
            <dt>{tr('metricsGuide:maeRmseAndIntervalCoverage')}</dt>
            <dd>{tr('metricsGuide:meanAbsolutePredictionErrorSquareRootOfMeanSquared')}</dd>
          </dl>
        </details>
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
