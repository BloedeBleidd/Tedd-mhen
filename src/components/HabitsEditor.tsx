import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { habitPresets, type HabitDefinition, type HabitRecord } from '../../shared/habits';
import { useApi, useLoad } from '../lib/api';
import { searchText } from '../lib/search-text';
import { t } from '../i18n';
import { ErrorBox, Field, NumberField, Panel } from './ui';

export const habitName = (record: Pick<HabitRecord, 'key' | 'name'>) =>
  record.key.startsWith('preset:')
    ? t('habitCatalog:' + record.key.slice(7))
    : record.name || record.key;

export function HabitsEditor({
  value,
  onChange,
}: {
  value: HabitRecord[];
  onChange: (records: HabitRecord[]) => void;
}) {
  useTranslation();
  const { request } = useApi();
  const active = useRef(true);
  const currentValue = useRef(value);
  currentValue.current = value;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const library = useLoad<{ definitions: HabitDefinition[] }>('/api/habit-definitions');
  const [created, setCreated] = useState<HabitDefinition[]>([]);
  const [query, setQuery] = useState(''),
    [chosen, setChosen] = useState(''),
    [name, setName] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const definitions = useMemo(
    () => [
      ...new Map(
        [...(library.data?.definitions || []), ...created].map((d) => [d.key, d]),
      ).values(),
    ],
    [library.data, created],
  );
  const available = [
    ...habitPresets.map((id) => ({ key: `preset:${id}`, name: null })),
    ...definitions.filter((d) => !d.archived),
  ].filter(
    (d) =>
      !value.some((r) => r.key === d.key) && searchText(habitName(d)).includes(searchText(query)),
  );
  function add(definition: { key: string; name: string | null }) {
    const records = currentValue.current;
    if (records.length >= 100 || records.some((r) => r.key === definition.key)) return;
    onChange([
      ...records,
      {
        key: definition.key,
        name: definition.name,
        count: null,
        times: [],
        durationMinutes: null,
        notes: '',
      },
    ]);
    setChosen('');
  }
  function edit(index: number, patch: Partial<HabitRecord>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  async function store(definition: HabitDefinition, track = false) {
    setBusy(true);
    setError(null);
    try {
      const saved = await request<HabitDefinition>('/api/habit-definitions', {
        method: 'PUT',
        body: JSON.stringify(definition),
      });
      if (!active.current) return;
      setCreated((rows) => [...rows.filter((d) => d.key !== saved.key), saved]);
      if (track) {
        add(saved);
        setName('');
      }
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <Panel id="habits" title={t('habits:title')} subtitle={t('habits:intro')}>
      <p className="small muted">{t('habits:semantics')}</p>
      <div className="fields-grid">
        <Field label={t('habits:search')}>
          <input
            value={query}
            maxLength={120}
            onChange={(e) => {
              setQuery(e.target.value);
              setChosen('');
            }}
          />
        </Field>
        <Field label={t('habits:choose')}>
          <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
            <option value="">{t('habits:select')}</option>
            {available.map((d) => (
              <option key={d.key} value={d.key}>
                {habitName(d)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {available.length === 0 && (
        <p role="status" className="small">
          {t('habits:noMatches')}
        </p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={!chosen || value.length >= 100}
        onClick={() => {
          const d = available.find((d) => d.key === chosen);
          if (d) add(d);
        }}
      >
        <Plus size={16} />
        {t('habits:add')}
      </button>
      <details className="habit-library">
        <summary>{t('habits:customLibrary')}</summary>
        <Field label={t('habits:customName')}>
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button
          type="button"
          className="button secondary"
          disabled={
            !name.trim() || busy || library.loading || !!library.error || value.length >= 100
          }
          onClick={() => {
            const existing = definitions.find(
              (d) => searchText(d.name) === searchText(name.trim()),
            );
            store(
              {
                key: existing?.key || `custom:${crypto.randomUUID()}`,
                name: existing?.name || name,
                archived: false,
              },
              true,
            );
          }}
        >
          {busy ? t('habits:saving') : t('habits:create')}
        </button>
        <p className="small muted">{t('habits:customHelp')}</p>
        {definitions.length > 0 && (
          <details>
            <summary>{t('habits:manage')}</summary>
            {definitions.map((d) => (
              <div className="habit-library-row" key={d.key}>
                <span>{d.name}</span>
                <button
                  type="button"
                  className="button secondary small-button"
                  disabled={busy}
                  onClick={() => store({ ...d, archived: !d.archived })}
                >
                  {d.archived ? t('habits:restore') : t('habits:archive')}
                </button>
              </div>
            ))}
            <p className="small muted">{t('habits:archiveHelp')}</p>
          </details>
        )}
      </details>
      {library.loading && (
        <p role="status" className="small">
          {t('habits:loading')}
        </p>
      )}
      <ErrorBox message={error || library.error} />
      {library.error && (
        <button type="button" className="button secondary" onClick={library.retry}>
          {t('habits:retry')}
        </button>
      )}
      {value.map((record, index) => (
        <div className="habit-editor" key={record.key}>
          <div className="workout-heading">
            <h3>{habitName(record)}</h3>
            <button
              type="button"
              className="icon-button danger-text"
              aria-label={t('habits:remove', { name: habitName(record) })}
              onClick={() => onChange(value.filter((r) => r.key !== record.key))}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="fields-grid">
            <NumberField
              label={t('habits:count', { name: habitName(record) })}
              value={record.count}
              min={0}
              max={100000}
              onChange={(count) => edit(index, { count })}
            />
            <NumberField
              label={t('habits:duration')}
              value={record.durationMinutes}
              min={0}
              max={1440}
              step={0.1}
              onChange={(durationMinutes) => edit(index, { durationMinutes })}
            />
          </div>
          <p className="field-label">{t('habits:times')}</p>
          <p className="small muted">{t('habits:timeHelp')}</p>
          <div className="habit-times">
            {record.times.map((time, i) => (
              <div key={i}>
                <Field label={t('habits:eventTime', { value: i + 1 })}>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) =>
                      edit(index, {
                        times: record.times.map((v, j) => (j === i ? e.target.value : v)),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('habits:removeTime', { value: i + 1 })}
                  onClick={() => edit(index, { times: record.times.filter((_, j) => i !== j) })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary small-button"
            disabled={record.times.length >= 500}
            onClick={() =>
              edit(index, {
                times: [...record.times, ''],
                count:
                  record.count === null ? null : Math.max(record.count, record.times.length + 1),
              })
            }
          >
            {t('habits:addTime')}
          </button>
          <details className="notes-details">
            <summary>{t('habits:notes')}</summary>
            <textarea
              aria-label={t('habits:noteLabel', { name: habitName(record) })}
              rows={2}
              maxLength={50000}
              value={record.notes}
              onChange={(e) => edit(index, { notes: e.target.value })}
            />
          </details>
        </div>
      ))}
    </Panel>
  );
}
