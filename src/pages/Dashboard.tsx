import { ArrowRight, ArrowUpRight, Heart, Moon, Plus, Timer, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useApi, useLoad } from '../lib/api';
import { localDate, shiftDate, type EntrySummary } from '../../shared/schema';
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
  const today = localDate(),
    { demo, toggleDemo } = useApi();
  const [days, setDays] = useState(28),
    [metric, setMetric] = useState<MetricKey>('wellbeing');
  const { data, loading, error } = useLoad<{ entries: EntrySummary[] }>(
    `/api/series?from=${shiftDate(today, -89)}&to=${today}`,
  );
  const allEntries = data?.entries || [],
    entries = allEntries.filter((e) => e.date >= shiftDate(today, -(days - 1))),
    latest = allEntries.at(-1),
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
    { label: 'Wellbeing', value: avg('wellbeing'), unit: '/ 10', icon: Heart, key: 'wellbeing' },
    {
      label: 'Sleep duration',
      value: avg('sleepHours'),
      unit: 'hours',
      icon: Moon,
      key: 'sleepHours',
    },
    { label: 'Heart rate variability', value: avg('hrv'), unit: 'ms', icon: Waves, key: 'hrv' },
    {
      label: 'Training time',
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
        eyebrow="THE BIG PICTURE"
        title="Find your rhythm."
        description="A place to connect how you train, sleep, and feel."
        action={
          <Link className="button primary" to="/check-in">
            <Plus size={17} /> Daily check-in
          </Link>
        }
      />
      <div className="overview-bar">
        <div className="section-label">
          <span className="live-dot" />
          {prettyDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div className="segmented" aria-label="Overview period">
          {[7, 28, 90].map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {d} days
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
                className={`stat-card ${i === 0 ? 'featured' : ''}`}
                key={label}
                onClick={() => setMetric(key as MetricKey)}
              >
                <div className="stat-label">
                  {label}
                  <Icon size={18} />
                </div>
                <div className="stat-value">
                  {number(value)} <span>{unit}</span>
                </div>
                <div className="stat-foot">
                  {i === 3 ? 'Recorded total' : 'Recorded average'} <span>over {days} days</span>
                </div>
              </button>
            ))}
          </div>
          {entries.length === 0 && !error ? (
            <Panel>
              <EmptyState />
              {!demo && (
                <button className="text-link empty-demo" onClick={toggleDemo}>
                  See what your journal could look like <ArrowRight size={16} />
                </button>
              )}
            </Panel>
          ) : (
            <>
              <div className="dashboard-grid">
                <Panel
                  title="Your days, in perspective"
                  subtitle="Recorded observations · gaps mean no measurement"
                  action={
                    <select
                      aria-label="Chart metric"
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as MetricKey)}
                    >
                      {Object.entries(metrics).map(([key, m]) => (
                        <option key={key} value={key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  }
                >
                  <TrendChart data={chart} unit={spec.unit} simple />
                  <div className="chart-footer">
                    <span>
                      <i className="legend-dot" />
                      {spec.label} <span className="muted">({spec.unit})</span>
                    </span>
                    <Link to="/analysis">
                      Explore Bayesian trends <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </Panel>
                <Panel
                  className="consistency-panel"
                  title="Small steps, lasting insight"
                  subtitle="Your last 28 days"
                >
                  <div className="consistency-number">
                    {allEntries.filter((e) => e.date >= shiftDate(today, -27)).length}
                    <span> / 28 days recorded</span>
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
                          title={`${date}: ${entry ? 'Recorded' : 'Not recorded'}`}
                        >
                          {new Date(`${date}T12:00`).getDate()}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="calendar-legend">
                    <span>
                      <i /> Not recorded
                    </span>
                    <span>
                      <i className="filled" /> Recorded
                    </span>
                  </div>
                  <p className="consistency-tip">
                    A short, consistent check-in is more useful than an occasional perfect one.
                  </p>
                  <Link className="text-link" to="/check-in">
                    Make space for today <ArrowRight size={16} />
                  </Link>
                </Panel>
              </div>
              <div className="dashboard-grid lower">
                <Panel
                  title="Recent journal"
                  subtitle="The details behind your numbers"
                  action={
                    <Link className="text-link" to="/journal">
                      View all <ArrowUpRight size={15} />
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
                                ? e.workoutTypes
                                    .map((t) => t[0].toUpperCase() + t.slice(1))
                                    .join(' + ')
                                : e.trainingStatus === 'rest'
                                  ? 'A day to recover'
                                  : 'Daily check-in'}
                            </strong>
                            <span>
                              {e.workoutCount
                                ? `${number(e.trainingMinutes)} min of training`
                                : 'Training: ' + e.trainingStatus}{' '}
                              · Wellbeing {number(e.wellbeing)}/10
                            </span>
                          </div>
                          <span className={`tag ${(e.illnessSeverity ?? 0) > 0 ? 'amber' : ''}`}>
                            {(e.illnessSeverity ?? 0) > 0
                              ? 'Symptoms'
                              : e.sleep.durationMinutes !== null
                                ? `${number(e.sleep.durationMinutes / 60)} h sleep`
                                : 'Sleep not recorded'}
                          </span>
                          <ArrowUpRight size={16} />
                        </Link>
                      ))}
                  </div>
                </Panel>
                <section className="insight-card">
                  <span className="eyebrow">CURIOUS BY NATURE</span>
                  <div className="orbit-art" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <i />
                  </div>
                  <h2>
                    Patterns need
                    <br />a little patience.
                  </h2>
                  <p>
                    {entries.length >= 14
                      ? 'You have enough daily records to start exploring. Each metric needs 14 observations of its own.'
                      : `Start with 14 observations of a metric to explore its trend. You have ${entries.length} daily records so far.`}
                  </p>
                  <Link to="/analysis">
                    See the evidence <ArrowUpRight size={16} />
                  </Link>
                </section>
              </div>
              {latest && (
                <p className="data-caption">
                  Last recorded day:{' '}
                  {prettyDate(latest.date, { day: 'numeric', month: 'long', year: 'numeric' })}.
                  Averages use only available measurements; sample sizes may differ.
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
