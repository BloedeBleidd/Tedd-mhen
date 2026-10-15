import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { enumLabel, localize, t as tr } from '../i18n';
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Moon,
  Plus,
  Timer,
  Waves,
  Network,
  SlidersHorizontal,
  Upload,
  Download,
} from 'lucide-react';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { useState } from 'react';
import { useLoad } from '../lib/api';
import { localDate, shiftDate, type EntrySummary, type JournalPage } from '../../shared/schema';
import { metrics, type MetricKey } from '../../shared/metrics';
import { TrendChart } from '../components/Charts';
import {
  EmptyState,
  ErrorBox,
  Loading,
  number,
  PageHeading,
  Panel,
  prettyDate,
} from '../components/ui';
export function Dashboard() {
  useTranslation();
  const today = localDate();
  const [days, setDays] = useState(28),
    [metric, setMetric] = useState<MetricKey>('wellbeing');
  const { data, loading, error } = useLoad<{ entries: EntrySummary[] }>(
    `/api/series?from=${shiftDate(today, -89)}&to=${today}`,
  );
  const journal = useLoad<JournalPage>('/api/entries?limit=1');
  const allEntries = data?.entries || [],
    entries = allEntries.filter((e) => e.date >= shiftDate(today, -(days - 1))),
    latest = journal.data?.entries[0] ?? allEntries.at(-1),
    spec = metrics[metric];
  const avg = (key: MetricKey) => {
    const values = entries.map(metrics[key].get).filter((v): v is number => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const records = new Map(allEntries.map((e) => [e.date, e]));
  const chart = Array.from({ length: days }, (_, i) => {
    const date = shiftDate(today, i - days + 1),
      entry = records.get(date);
    return {
      date,
      observed: entry ? spec.get(entry) : null,
      mean: 0,
      credible: [0, 0] as [number, number],
      predictive: [0, 0] as [number, number],
      forecast: false,
    };
  });
  const cards = [
    {
      label: tr('dashboard:wellbeing'),
      value: avg('wellbeing'),
      unit: '/ 10',
      icon: Heart,
      key: 'wellbeing',
    },
    {
      label: tr('dashboard:sleepDuration'),
      value: avg('sleepHours'),
      unit: 'hours',
      icon: Moon,
      key: 'sleepHours',
    },
    {
      label: tr('dashboard:heartRateVariability'),
      value: avg('hrv'),
      unit: 'ms',
      icon: Waves,
      key: 'hrv',
    },
    {
      label: tr('dashboard:trainingTime'),
      value: entries.some((e) => e.trainingMinutes !== null)
        ? entries.reduce((s, e) => s + (e.trainingMinutes ?? 0), 0) / 60
        : null,
      unit: 'hours',
      icon: Timer,
      key: 'trainingHours',
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={tr('dashboard:theBigPicture')}
        title={tr('dashboard:findYourRhythm')}
        description={tr('dashboard:aPlaceToConnectHowYouTrainSleepAnd')}
        action={
          <Link className="button primary" to="/check-in">
            <Trans i18nKey="dashboard:dailyCheckIn" components={{ slot0: <Plus size={17} /> }} />
          </Link>
        }
      />
      <nav className="explore-grid" aria-label={tr('dashboard:exploreYourJournal')}>
        {[
          {
            to: '/analysis/relationships',
            title: tr('dashboard:findConnections'),
            text: tr('dashboard:compareSleepTrainingMoodAndContextLabels'),
            icon: Network,
          },
          {
            to: '/analysis/prediction',
            title: tr('dashboard:predictWithMultipleInputs'),
            text: tr('dashboard:exploreBayesianEstimatesAndTheirUncertainty'),
            icon: SlidersHorizontal,
          },
          {
            to: '/import',
            title: tr('dashboard:bringYourHistory'),
            text: tr('dashboard:previewAndImportAnExistingJournalExport'),
            icon: Upload,
          },
          {
            to: '/export',
            title: tr('dashboard:exportOrBackUp'),
            text: tr('dashboard:chooseMeasurementsForAnalysisOrKeepAFullCopy'),
            icon: Download,
          },
        ].map(({ to, title, text, icon: Icon }) => (
          <Link key={to} to={to}>
            <Icon size={21} />
            <strong>{title}</strong>
            <span>{text}</span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </nav>
      <div className="overview-bar">
        <div className="section-label">
          <span className="live-dot" />
          {prettyDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div className="segmented" aria-label={tr('dashboard:overviewPeriod')}>
          {[7, 28, 90].map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              <Trans i18nKey="dashboard:days" components={{ slot0: <MessageValue value={d} /> }} />
            </button>
          ))}
        </div>
      </div>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="stat-grid">
            {cards.map(({ label, value, unit, icon: Icon, key }, i) => (
              <button
                className={`stat-card ${i === 0 ? 'featured' : ''} ${metric === key ? 'selected' : ''}`}
                aria-pressed={metric === key}
                key={label}
                onClick={() => setMetric(key as MetricKey)}
              >
                <div className="stat-label">
                  {label}
                  <Icon size={18} />
                </div>
                <div className="stat-value">
                  {number(value)} <span>{localize(unit)}</span>
                </div>
                <div className="stat-foot">
                  {i === 3 ? tr('dashboard:recordedTotal') : tr('dashboard:recordedAverage')}{' '}
                  <span>
                    <Trans
                      i18nKey="dashboard:observationsDays"
                      components={{
                        slot0: (
                          <MessageValue
                            value={
                              entries.filter(
                                (entry) => metrics[key as MetricKey].get(entry) !== null,
                              ).length
                            }
                          />
                        ),
                        slot1: <MessageValue value={days} />,
                      }}
                    />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {entries.length === 0 && !error ? (
            <Panel>
              {journal.data?.total ? (
                <>
                  <h2>
                    <Trans
                      i18nKey="dashboard:noEntriesInTheLastDays"
                      components={{ slot0: <MessageValue value={days} /> }}
                    />
                  </h2>
                  <p>
                    <Trans
                      i18nKey="dashboard:yourJournalContainsRecordedDaysChooseAWiderOverview"
                      components={{ slot0: <MessageValue value={journal.data.total} /> }}
                    />
                  </p>
                  <Link className="button primary" to="/journal">
                    {tr('dashboard:browseAllRecordedDays')}
                  </Link>
                </>
              ) : journal.loading ? (
                <Loading />
              ) : journal.error ? (
                <ErrorBox message={journal.error} />
              ) : (
                <>
                  <EmptyState />
                  <Link className="button secondary" to="/import">
                    {tr('dashboard:alreadyHaveDataImportYourJournal')}
                  </Link>
                </>
              )}
            </Panel>
          ) : (
            <>
              <div className="dashboard-grid">
                <Panel
                  title={tr('dashboard:yourDaysInPerspective')}
                  subtitle={tr('dashboard:recordedObservationsGapsMeanNoMeasurement')}
                  action={
                    <select
                      aria-label={tr('dashboard:chartMetric')}
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as MetricKey)}
                    >
                      {Object.entries(metrics).map(([key, m]) => (
                        <option key={key} value={key}>
                          {localize(m.label)}
                        </option>
                      ))}
                    </select>
                  }
                >
                  <TrendChart data={chart} unit={localize(spec.unit)} simple />
                  <div className="chart-footer">
                    <span>
                      <i className="legend-dot" />
                      {localize(spec.label)} <span className="muted">({localize(spec.unit)})</span>
                    </span>
                    <Link to="/analysis">
                      <Trans
                        i18nKey="dashboard:exploreBayesianTrends"
                        components={{ slot0: <ArrowUpRight size={14} /> }}
                      />
                    </Link>
                  </div>
                </Panel>
                <Panel
                  className="consistency-panel"
                  title={tr('dashboard:smallStepsLastingInsight')}
                  subtitle={tr('dashboard:yourLast28Days')}
                >
                  <div className="consistency-number">
                    {allEntries.filter((e) => e.date >= shiftDate(today, -27)).length}
                    <span>{tr('dashboard:28DaysRecorded')}</span>
                  </div>
                  <div className="calendar-grid">
                    {Array.from({ length: 28 }, (_, i) => {
                      const date = shiftDate(today, i - 27),
                        entry = records.get(date);
                      return (
                        <Link
                          to={`/check-in?date=${date}`}
                          className={`calendar-day ${entry ? 'recorded' : ''} ${date === today ? 'today' : ''}`}
                          key={date}
                          title={`${date}: ${entry ? tr('dashboard:recorded') : tr('dashboard:notRecorded')}`}
                        >
                          {new Date(`${date}T12:00`).getDate()}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="calendar-legend">
                    <span>
                      <Trans i18nKey="dashboard:notRecorded2" components={{ slot0: <i /> }} />
                    </span>
                    <span>
                      <Trans
                        i18nKey="dashboard:recorded2"
                        components={{ slot0: <i className="filled" /> }}
                      />
                    </span>
                  </div>
                  <p className="consistency-tip">
                    {tr('dashboard:aShortConsistentCheckInIsMoreUsefulThan')}
                  </p>
                  <Link className="text-link" to="/check-in">
                    <Trans
                      i18nKey="dashboard:makeSpaceForToday"
                      components={{ slot0: <ArrowRight size={16} /> }}
                    />
                  </Link>
                </Panel>
              </div>
              <div className="dashboard-grid lower">
                <Panel
                  title={tr('dashboard:recentJournal')}
                  subtitle={tr('dashboard:theDetailsBehindYourNumbers')}
                  action={
                    <Link className="text-link" to="/journal">
                      <Trans
                        i18nKey="dashboard:viewAll"
                        components={{ slot0: <ArrowUpRight size={15} /> }}
                      />
                    </Link>
                  }
                >
                  <div className="recent-list">
                    {entries
                      .slice(-4)
                      .reverse()
                      .map((e) => (
                        <Link to={`/check-in?date=${e.date}`} key={e.date} className="recent-entry">
                          <div className="date-tile">
                            <strong>{prettyDate(e.date, { day: 'numeric' })}</strong>
                            <small>{prettyDate(e.date, { month: 'short' })}</small>
                          </div>
                          <div className="recent-description">
                            <strong>
                              {e.workoutTypes.length
                                ? e.workoutTypes.map((type) => tr(`activities:${type}`)).join(' + ')
                                : e.trainingStatus === 'rest'
                                  ? tr('dashboard:aDayToRecover')
                                  : tr('dashboard:dailyCheckIn2')}
                            </strong>
                            <span>
                              <Trans
                                i18nKey="dashboard:wellbeing10"
                                components={{
                                  slot0: (
                                    <MessageValue
                                      value={
                                        e.workoutCount
                                          ? tr('dashboard:minOfTraining', {
                                              value0: number(e.trainingMinutes),
                                            })
                                          : tr('dashboard:trainingStatus', {
                                              status: enumLabel(e.trainingStatus),
                                            })
                                      }
                                    />
                                  ),
                                  slot1: <MessageValue value={number(e.wellbeing)} />,
                                }}
                              />
                            </span>
                          </div>
                          <span className={`tag ${(e.illnessSeverity ?? 0) > 0 ? 'amber' : ''}`}>
                            {(e.illnessSeverity ?? 0) > 0
                              ? tr('dashboard:symptoms')
                              : e.sleep.durationMinutes !== null
                                ? tr('dashboard:hSleep', {
                                    value0: number(e.sleep.durationMinutes / 60),
                                  })
                                : tr('dashboard:sleepNotRecorded')}
                          </span>
                          <ArrowUpRight size={16} />
                        </Link>
                      ))}
                  </div>
                </Panel>
                <section className="insight-card">
                  <span className="eyebrow">{tr('dashboard:curiousByNature')}</span>
                  <div className="orbit-art" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <i />
                  </div>
                  <h2>
                    <Trans
                      i18nKey="dashboard:patternsNeedALittlePatience"
                      components={{ slot0: <br /> }}
                    />
                  </h2>
                  <p>
                    {entries.length >= 14
                      ? tr('dashboard:youHaveEnoughDailyRecordsToStartExploringEach')
                      : tr('dashboard:startWith14ObservationsOfAMetricToExplore', {
                          value0: entries.length,
                        })}
                  </p>
                  <Link to="/analysis">
                    <Trans
                      i18nKey="dashboard:seeTheEvidence"
                      components={{ slot0: <ArrowUpRight size={16} /> }}
                    />
                  </Link>
                </section>
              </div>
              {latest && (
                <p className="data-caption">
                  <Trans
                    i18nKey="dashboard:lastRecordedDayAveragesUseOnlyAvailableMeasurementsSample"
                    components={{
                      slot0: (
                        <MessageValue
                          value={prettyDate(latest.date, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        />
                      ),
                    }}
                  />
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
