import { useTranslation, Trans } from 'react-i18next';
import { localize, t as tr } from '../i18n';
import { BookOpen, ExternalLink, LockKeyhole } from 'lucide-react';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { scaleDefinitions } from '../../shared/schema';
import { PageHeading, Panel } from '../components/ui';
import { authorUrl } from '../lib/author';
import { useLanguage } from '../lib/language-context';
export function Help() {
  useTranslation();
  const { language } = useLanguage();
  return (
    <>
      <PageHeading
        eyebrow={tr('help:aLittleGuidance')}
        title={tr('help:betterRecordsBetterQuestions')}
        description={tr('help:howToUseYourJournalAndUnderstandWhatThe')}
      />
      <div className="help-intro">
        <BookOpen size={28} strokeWidth={1.3} />
        <div>
          <h2>{tr('help:startSmallRecordConsistently')}</h2>
          <p>{tr('help:takeTwoMinutesAtASimilarTimeEachDay')}</p>
        </div>
        <Link className="button primary" to="/check-in">
          {tr('help:makeACheckIn')}
        </Link>
      </div>
      <div className="help-grid">
        <Panel title={tr('habits:title')}>
          <p>{tr('habits:intro')}</p>
          <p>{tr('habits:semantics')}</p>
          <p>{tr('habits:reviewGuide')}</p>
          <Link className="text-link" to="/check-in#habits">
            {tr('habits:openCheckIn')}
          </Link>
        </Panel>
        <Panel title={tr('help:01MakeADailyCheckIn')}>
          <p>{tr('help:pickTheLocalDateSelectTheRatingsYouActually')}</p>
          <p>
            <Trans
              i18nKey="help:chooseRestDayWhenYouDidNotTrainLeave"
              components={{ slot0: <b />, slot1: <b /> }}
            />
          </p>
          <p>{tr('help:bedtimeAndWakeTimeAreLocalClockTimesThe')}</p>
        </Panel>
        <Panel title={tr('help:02KeepYourScalesConsistent')}>
          <p>{tr('help:theseAreProjectDefinedSelfReportScalesNotValidated')}</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr('help:metric')}</th>
                  <th>{tr('help:lowAnchor')}</th>
                  <th>{tr('help:highAnchor')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(scaleDefinitions).map((s) => (
                  <tr key={localize(s.label)}>
                    <td>{localize(s.label)}</td>
                    <td>
                      {s.min} · {localize(s.low)}
                    </td>
                    <td>10 · {localize(s.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{tr('help:sleepQuality1VeryPoor10ExcellentSymptoms1')}</p>
        </Panel>
        <Panel title={tr('help:03UnderstandTrainingLoad')}>
          <p>{tr('help:sessionLoadDurationInMinutesPerceivedEffortDailyLoad')}</p>
          <p>{tr('help:thisIsASimpleProjectDefinedTrackingHeuristicIt')}</p>
          <p>{tr('help:forStrengthTrainingAddExercisesWithSetCountRepetitions')}</p>
        </Panel>
        <Panel title={tr('help:04ReadABayesianTrend')}>
          <p>{tr('help:theModelCombinesAStatedPriorWithYourObservations')}</p>
          <p>
            <Trans
              i18nKey="help:95CredibleIntervalUncertaintyAboutTheAverageTrajectoryConditional"
              components={{ slot0: <b />, slot1: <b /> }}
            />
          </p>
          <p>
            <Trans
              i18nKey="help:probabilityOfAnIncreasingTrendPosteriorProbabilityThatThe"
              components={{ slot0: <b /> }}
            />
          </p>
        </Panel>
        <Panel title={tr('help:05KnowTheLimits')}>
          <p>{tr('help:theModelAssumesALinearPatternApproximatelyGaussianNoise')}</p>
          <p>{tr('help:boundedRatingsAreTreatedAsApproximatelyContinuousIntervalsAre')}</p>
          <p>{tr('help:changingDevicesHrvMethodsMissingDaysAndExcludingIllness')}</p>
        </Panel>
        <Panel title={tr('help:06ExportExactlyWhatYouNeed')}>
          <p>{tr('help:selectYourDateWindowDataGroupsAndFormatWritten')}</p>
          <p>
            <Trans
              i18nKey="help:ndjsonBeginsWithAMetaLineSubsequentLinesAre"
              components={{ slot0: <code /> }}
            />
          </p>
          <p>{tr('help:noAiProviderIsConnectedToThisApplicationExported')}</p>
        </Panel>
        <Panel title={tr('help:exploreWithDemoData')}>
          <p>{tr('help:beforeSigningInOpenDemoOrChooseTryDemo')}</p>
          <p>{tr('help:tryEveryJournalAnalysisImportAndExportViewEdits')}</p>
          <p>{tr('help:theRelationshipsWereDeliberatelyConstructedToDemonstrateTheTools')}</p>
        </Panel>
        <Panel title={tr('help:07ExploreRelationships')}>
          <p>{tr('help:chooseAnOutcomeAndCompareOtherMeasurementsOnThe')}</p>
          <p>
            {tr('help:pearsonMeasuresLinearAssociationSpearmanMeasuresRankedAssociationRankings')}
          </p>
          <Link className="text-link" to="/analysis/relationships">
            {tr('help:exploreRelationships')}
          </Link>
        </Panel>
        <Panel title={tr('help:08PredictWithMultipleInputs')}>
          <p>{tr('help:chooseAnOutcomeASameDayOr13')}</p>
          <p>{tr('help:theModelShowsConditionalAssociationsUncertaintyAndAChronological')}</p>
          <p>{tr('help:recordLabelsConsistentlyUncheckedContextMeansUnknownWhileRecording')}</p>
          <Link className="text-link" to="/analysis/metrics">
            {tr('help:definitionsAmpMethods')}
          </Link>
        </Panel>
        <Panel title={tr('help:09ImportAnExistingJournal')}>
          <p>{tr('help:selectAJsonNdjsonOrCompatibleCsvFileReview')}</p>
          <p>{tr('help:eachDayHasItsOwnRevisionCheckAndResult')}</p>
          <Link className="text-link" to="/import">
            {tr('help:importObservations')}
          </Link>
        </Panel>
      </div>
      <Panel title={tr('help:privateDeploymentDataOwnership')} action={<LockKeyhole size={19} />}>
        <p>{tr('help:createAnAccountWithAnEmailIdentifierAndA')}</p>
        <p>{tr('help:eachAccountCanAccessOnlyItsOwnRecordsThe')}</p>
        <p>{tr('help:appearanceOffersLightDarkAndAutoAutoUsesSunrise')}</p>
        <p>
          <Trans
            i18nKey="help:seeTheDeploymentAndBackupGuideNarrativeFieldsSupport"
            components={{
              slot0: (
                <a
                  href="https://github.com/BloedeBleidd/Tedd-mhen/blob/main/docs/DEPLOYMENT.md"
                  target="_blank"
                  rel="noreferrer"
                />
              ),
              slot1: <ExternalLink size={13} />,
            }}
          />
        </p>
        <p>
          <Trans
            i18nKey="help:authorizedAdministratorsCanViewAggregateAccountCountsJournalVolume"
            components={{ slot0: <a href={authorUrl(language)} /> }}
          />
        </p>
      </Panel>
      <Panel title={tr('help:methodologyPrimaryReferences')}>
        <div className="reference-list">
          <a
            href="https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf"
            target="_blank"
            rel="noreferrer"
          >
            <Trans
              i18nKey="help:kevinPMurphyConjugateBayesianAnalysisOfTheGaussian"
              components={{ slot0: <ExternalLink size={14} /> }}
            />
          </a>
          <a
            href="https://github.com/BloedeBleidd/Tedd-mhen/blob/main/docs/METHODOLOGY.md"
            target="_blank"
            rel="noreferrer"
          >
            <Trans
              i18nKey="help:modelEquationsPriorsAssumptionsAndValidation"
              components={{ slot0: <ExternalLink size={14} /> }}
            />
          </a>
          <a
            href="https://developers.cloudflare.com/d1/platform/limits/"
            target="_blank"
            rel="noreferrer"
          >
            <Trans
              i18nKey="help:cloudflareD1StorageAndRequestLimits"
              components={{ slot0: <ExternalLink size={14} /> }}
            />
          </a>
        </div>
      </Panel>
    </>
  );
}
