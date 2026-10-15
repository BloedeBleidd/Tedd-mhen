import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { useLoad } from '../lib/api';
import { workoutTypes, type EntrySummary } from '../../shared/schema';
import {
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  number,
  PageHeading,
  Panel,
  prettyDate,
} from '../components/ui';
export function Journal() {
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [type, setType] = useState(''),
    [illness, setIllness] = useState('all'),
    [cursors, setCursors] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setCursors([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  const query = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    q: search,
    type,
    illness,
    cursor: cursors.at(-1) || '',
    limit: '30',
  });
  const { data, loading, error } = useLoad<{
    entries: EntrySummary[];
    nextCursor: string | null;
    total: number;
  }>(`/api/entries?${query}`);
  const filtered = !!(from || to || search || type || illness !== 'all');
  function reset() {
    setFrom('');
    setTo('');
    setQ('');
    setSearch('');
    setType('');
    setIllness('all');
    setCursors([]);
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR PERSONAL RECORD"
        title="Every day tells a story."
        description="Revisit the details. Find the days that matter."
        action={
          <Link className="button primary" to="/check-in">
            <Plus size={17} /> Add a check-in
          </Link>
        }
      />
      <Panel className="filter-panel">
        <div className="filter-title">
          <SlidersHorizontal size={17} />
          <strong>Filter your journal</strong>
          {filtered && (
            <button className="text-link" onClick={reset}>
              Clear filters
            </button>
          )}
        </div>
        <div className="journal-filters">
          <Field label="Search">
            <span className="search-input">
              <Search size={16} />
              <input
                value={q}
                maxLength={200}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Notes, sessions, symptoms…"
              />
            </span>
          </Field>
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setCursors([]);
              }}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setCursors([]);
              }}
            />
          </Field>
          <Field label="Activity">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setCursors([]);
              }}
            >
              <option value="">All activities</option>
              {workoutTypes.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Illness">
            <select
              value={illness}
              onChange={(e) => {
                setIllness(e.target.value);
                setCursors([]);
              }}
            >
              <option value="all">All days</option>
              <option value="yes">Illness / symptoms</option>
              <option value="no">Explicitly no illness</option>
            </select>
          </Field>
        </div>
      </Panel>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <Panel
            title={`${data.total} ${data.total === 1 ? 'day' : 'days'} in your journal`}
            subtitle="Newest first · click a date to view or edit the complete entry"
            action={<span className="tag">Page {cursors.length + 1}</span>}
          >
            {data.entries.length === 0 ? (
              <EmptyState
                title={filtered ? 'No days match these filters.' : 'Your journal starts here.'}
                description={
                  filtered
                    ? 'Try a wider date range or clear a filter.'
                    : 'Record a check-in to build your personal history.'
                }
                action={!filtered}
              />
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          Date <ArrowDown size={12} />
                        </th>
                        <th>Activity</th>
                        <th>Wellbeing</th>
                        <th>Sleep</th>
                        <th>HRV</th>
                        <th>Training</th>
                        <th>Illness</th>
                        <th>
                          <span className="sr-only">Edit</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries.map((e) => (
                        <tr key={e.date}>
                          <td>
                            <Link className="date-link" to={`/check-in?date=${e.date}`}>
                              {prettyDate(e.date, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                              <small>{prettyDate(e.date, { weekday: 'long' })}</small>
                            </Link>
                          </td>
                          <td>
                            <div className="activity-tags">
                              {e.workoutTypes.length ? (
                                e.workoutTypes.map((t) => (
                                  <span key={t} className="tag">
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span className="muted">
                                  {e.trainingStatus === 'rest' ? 'Rest day' : 'Not recorded'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="score-badge">{number(e.wellbeing)}</span>
                            <span className="muted small"> / 10</span>
                          </td>
                          <td>
                            {e.sleep.durationMinutes === null
                              ? '—'
                              : `${number(e.sleep.durationMinutes / 60)} h`}
                          </td>
                          <td>
                            {e.physiology.hrv === null ? '—' : `${number(e.physiology.hrv)} ms`}
                          </td>
                          <td>
                            {e.trainingMinutes === null ? '—' : `${number(e.trainingMinutes)} min`}
                          </td>
                          <td>
                            {e.illnessSeverity === null ? (
                              '—'
                            ) : (
                              <span className={`tag ${e.illnessSeverity > 0 ? 'amber' : ''}`}>
                                {e.illnessSeverity}/10
                              </span>
                            )}
                          </td>
                          <td>
                            <Link
                              className="icon-button"
                              to={`/check-in?date=${e.date}`}
                              aria-label={`Edit ${e.date}`}
                            >
                              <ArrowUpRight size={17} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>
                    {cursors.length * 30 + 1}–{cursors.length * 30 + data.entries.length} of{' '}
                    {data.total} days
                  </span>
                  <div className="button-group">
                    <button
                      className="button secondary small-button"
                      disabled={!cursors.length}
                      onClick={() => setCursors((c) => c.slice(0, -1))}
                    >
                      Previous
                    </button>
                    <button
                      className="button secondary small-button"
                      disabled={!data.nextCursor}
                      onClick={() => setCursors((c) => [...c, data.nextCursor!])}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </Panel>
        )
      )}
    </>
  );
}
