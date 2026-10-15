import { RememberedSelect } from '../components/RememberedSelect';
import { habitPresets, type HabitDefinition } from '../../shared/habits';
import { habitName } from '../components/HabitsEditor';
import { ActivitySelect } from '../components/ActivitySelect';
import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { t as tr } from '../i18n';
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
  useTranslation();
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [type, setType] = useState(''),
    [habit, setHabit] = useState(''),
    [illness, setIllness] = useState('all'),
    [cursors, setCursors] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setCursors([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  const library = useLoad<{ definitions: HabitDefinition[] }>('/api/habit-definitions');
  const query = new URLSearchParams({
    habit,
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
  const filtered = !!(from || to || search || type || habit || illness !== 'all');
  function reset() {
    setFrom('');
    setTo('');
    setQ('');
    setSearch('');
    setType('');
    setHabit('');
    setIllness('all');
    setCursors([]);
  }
  return (
    <>
      <PageHeading
        eyebrow={tr('journal:yourPersonalRecord')}
        title={tr('journal:everyDayTellsAStory')}
        description={tr('journal:revisitTheDetailsFindTheDaysThatMatter')}
        action={
          <Link className="button primary" to="/check-in">
            <Trans i18nKey="journal:addACheckIn" components={{ slot0: <Plus size={17} /> }} />
          </Link>
        }
      />
      <Panel className="filter-panel">
        <div className="filter-title">
          <SlidersHorizontal size={17} />
          <strong>{tr('journal:filterYourJournal')}</strong>
          {filtered && (
            <button className="text-link" onClick={reset}>
              {tr('journal:clearFilters')}
            </button>
          )}
        </div>
        <div className="journal-filters">
          <Field label={tr('journal:search')}>
            <span className="search-input">
              <Search size={16} />
              <input
                value={q}
                maxLength={200}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr('journal:notesSessionsSymptoms')}
              />
            </span>
          </Field>
          <Field label={tr('journal:from')}>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setCursors([]);
              }}
            />
          </Field>
          <Field label={tr('journal:to')}>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setCursors([]);
              }}
            />
          </Field>
          <div className="field">
            <span>{tr('journal:activity')}</span>
            <ActivitySelect
              value={type || 'all'}
              includeAll
              onChange={(value) => {
                setType(value === 'all' ? '' : value);
                setCursors([]);
              }}
            />
          </div>
          <Field label={tr('habits:filter')}>
            <RememberedSelect
              list="habit"
              value={habit}
              onChange={(e) => {
                setHabit(e.target.value);
                setCursors([]);
              }}
            >
              <option value="">{tr('habits:all')}</option>
              {[
                ...habitPresets.map((id) => ({ key: `preset:${id}`, name: null })),
                ...(library.data?.definitions || []),
              ].map((d) => (
                <option key={d.key} value={d.key}>
                  {habitName(d)}
                </option>
              ))}
            </RememberedSelect>
          </Field>
          <Field label={tr('journal:illness')}>
            <select
              value={illness}
              onChange={(e) => {
                setIllness(e.target.value);
                setCursors([]);
              }}
            >
              <option value="all">{tr('journal:allDays')}</option>
              <option value="yes">{tr('journal:illnessSymptoms')}</option>
              <option value="no">{tr('journal:explicitlyNoIllness')}</option>
            </select>
          </Field>
        </div>
      </Panel>
      <ErrorBox message={error || library.error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <Panel
            title={tr('journal:inYourJournal', {
              count: data.total,
            })}
            subtitle={tr('journal:newestFirstClickADateToViewOrEdit')}
            action={
              <span className="tag">
                <Trans
                  i18nKey="journal:page"
                  components={{ slot0: <MessageValue value={cursors.length + 1} /> }}
                />
              </span>
            }
          >
            {data.entries.length === 0 ? (
              <EmptyState
                title={
                  filtered
                    ? tr('journal:noDaysMatchTheseFilters')
                    : tr('journal:yourJournalStartsHere')
                }
                description={
                  filtered
                    ? tr('journal:tryAWiderDateRangeOrClearAFilter')
                    : tr('journal:recordACheckInToBuildYourPersonalHistory')
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
                          <Trans
                            i18nKey="journal:date"
                            components={{ slot0: <ArrowDown size={12} /> }}
                          />
                        </th>
                        <th>{tr('journal:activity')}</th>
                        <th>{tr('habits:title')}</th>
                        <th>{tr('journal:wellbeing')}</th>
                        <th>{tr('journal:sleep')}</th>
                        <th>{tr('journal:hrv')}</th>
                        <th>{tr('journal:training')}</th>
                        <th>{tr('journal:illness')}</th>
                        <th>
                          <span className="sr-only">{tr('journal:edit')}</span>
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
                                    {tr(`activities:${t}`)}
                                  </span>
                                ))
                              ) : (
                                <span className="muted">
                                  {e.trainingStatus === 'rest'
                                    ? tr('journal:restDay')
                                    : tr('journal:notRecorded')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="activity-tags">
                              {(e.habits || []).slice(0, 3).map((record) => (
                                <span key={record.key} className="tag">
                                  {habitName(record)}:{' '}
                                  {record.count === null
                                    ? tr('habits:recorded')
                                    : number(record.count, 0)}
                                </span>
                              ))}
                              {(e.habits?.length || 0) > 3 && (
                                <Link className="text-link" to={`/check-in?date=${e.date}#habits`}>
                                  {tr('habitMetadata:viewAll')}
                                </Link>
                              )}
                              {!e.habits?.length && <span className="muted">—</span>}
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
                            {e.physiology.hrv === null
                              ? '—'
                              : tr('journal:ms', { value0: number(e.physiology.hrv) })}
                          </td>
                          <td>
                            {e.trainingMinutes === null
                              ? '—'
                              : tr('journal:min', { value0: number(e.trainingMinutes) })}
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
                              aria-label={tr('journal:edit2', { value0: e.date })}
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
                    <Trans
                      i18nKey="journal:ofDays"
                      components={{
                        slot0: <MessageValue value={cursors.length * 30 + 1} />,
                        slot1: <MessageValue value={cursors.length * 30 + data.entries.length} />,
                        slot2: <MessageValue value={data.total} />,
                      }}
                    />
                  </span>
                  <div className="button-group">
                    <button
                      className="button secondary small-button"
                      disabled={!cursors.length}
                      onClick={() => setCursors((c) => c.slice(0, -1))}
                    >
                      {tr('journal:previous')}
                    </button>
                    <button
                      className="button secondary small-button"
                      disabled={!data.nextCursor}
                      onClick={() => setCursors((c) => [...c, data.nextCursor!])}
                    >
                      {tr('journal:next')}
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
