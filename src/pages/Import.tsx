import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { t as tr } from '../i18n';
import { errorText, fieldName } from '../lib/validation-messages';
import { useBlocker } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ApiError, useApi, useLoad } from '../lib/api';
import { parseImport, mergeImported, IMPORT_MAX_BYTES, type ImportRow } from '../../shared/import';
import type { StoredEntry } from '../../shared/schema';
import { ErrorBox, Field, PageHeading, Panel } from '../components/ui';
export function Import() {
  useTranslation();
  const { request, invalidate, demo } = useApi(),
    session = useLoad<{ id: string; email: string }>('/api/session');
  const [rows, setRows] = useState<ImportRow[]>([]),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [mode, setMode] = useState<'skip' | 'merge'>('skip'),
    [busy, setBusy] = useState(false),
    [results, setResults] = useState<
      { date: string; status: 'created' | 'merged' | 'skipped' | 'failed'; error?: string }[]
    >([]),
    [confirmed, setConfirmed] = useState(false);
  const stopped = useRef(false),
    readVersion = useRef(0);
  useEffect(
    () => () => {
      stopped.current = true;
      readVersion.current++;
    },
    [],
  );
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [busy]);
  const blocker = useBlocker(busy);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(tr('import:stopImportingAndLeaveCompletedSavesRemainARequest'))) {
      stopped.current = true;
      blocker.proceed();
    } else blocker.reset();
  }, [blocker]);
  async function read(file: File | undefined) {
    const version = ++readVersion.current;
    setError('');
    setRows([]);
    setResults([]);
    setConfirmed(false);
    if (!file) return;
    setName(file.name);
    try {
      if (file.size > IMPORT_MAX_BYTES) throw new Error('Choose a file smaller than 20 MiB.');
      const extension = file.name.split('.').at(-1)?.toLowerCase();
      if (!['json', 'ndjson', 'jsonl', 'csv'].includes(extension || ''))
        throw new Error('Use JSON, NDJSON or CSV. Markdown is a report, not an import format.');
      const text = await file.text();
      if (version !== readVersion.current) return;
      setRows(
        parseImport(
          text,
          extension === 'jsonl' ? 'ndjson' : (extension as 'json' | 'ndjson' | 'csv'),
        ),
      );
    } catch (e) {
      if (version !== readVersion.current) return;
      setError(e instanceof Error ? e.message : 'import:couldNotReadThisFile');
    }
  }
  async function run() {
    if (busy || !confirmed || !rows.length || !session.data) return;
    setBusy(true);
    setResults([]);
    stopped.current = false;
    setError('');
    const completed: {
      date: string;
      status: 'created' | 'merged' | 'skipped' | 'failed';
      error?: string;
    }[] = [];
    for (const row of rows) {
      if (stopped.current) break;
      try {
        let existing: StoredEntry | undefined;
        try {
          existing = await request<StoredEntry>(`/api/entries/${row.date}`);
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 404) throw e;
        }
        if (stopped.current) break;
        if (existing && mode === 'skip') {
          completed.push({ date: row.date, status: 'skipped' });
        } else {
          const entry = mergeImported(row, existing);
          await request(`/api/entries/${row.date}`, {
            method: 'PUT',
            headers: { 'X-Teddmhen-Expected-User': session.data.id },
            body: JSON.stringify({ entry, revision: existing?.revision ?? 0 }),
          });
          completed.push({
            date: row.date,
            status: existing ? 'merged' : 'created',
          });
        }
      } catch (e) {
        completed.push({
          date: row.date,
          status: 'failed',
          error: e instanceof Error ? e.message : 'Request failed.',
        });
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setError('import:importStoppedBecauseAccountAccessChangedCompletedRowsAre');
          break;
        }
      }
      setResults([...completed]);
    }
    setResults(completed);
    setBusy(false);
    setConfirmed(false);
    if (stopped.current) setError('import:importStoppedCompletedSavesRemainInYourJournalReview');
    invalidate();
  }
  return (
    <>
      <PageHeading
        eyebrow={tr('import:bringYourHistory')}
        title={tr('import:importJournalObservations')}
        description={tr('import:previewACompatibleExportChooseHowToHandleExisting')}
      />
      <Panel title={tr('import:chooseAFile')}>
        <p>{tr('import:jsonAndNdjsonPreserveTypesAndTextBestCsv')}</p>
        <Field label={tr('import:journalExportFile')}>
          <input
            className="sr-only"
            type="file"
            accept=".json,.ndjson,.jsonl,.csv"
            disabled={busy}
            onChange={(e) => void read(e.target.files?.[0])}
          />
          <span className="button secondary">{tr('import:chooseAFile')}</span>
          <small>{name || tr('import:noFile')}</small>
        </Field>
        <p className="small muted">{tr('import:upTo500Days20MibPerFileFile')}</p>
        <ErrorBox message={error || null} />
      </Panel>
      {rows.length > 0 && (
        <>
          <Panel title={tr('import:daysReadyForReview', { value0: rows.length })} subtitle={name}>
            <p>
              <Trans
                i18nKey="import:destinationMissingFieldsStayUnchangedOnExistingDaysOn"
                components={{
                  slot0: <strong />,
                  slot1: (
                    <MessageValue
                      value={demo ? tr('import:syntheticDemoMemory') : session.data?.email}
                    />
                  ),
                }}
              />
            </p>
            <Field label={tr('import:existingDayPolicy')}>
              <select
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  setMode(e.target.value as 'skip' | 'merge');
                  setConfirmed(false);
                }}
              >
                <option value="skip">{tr('import:skipExistingDays')}</option>
                <option value="merge">
                  {tr('import:mergeOnlySuppliedFieldsIntoExistingDays')}
                </option>
              </select>
            </Field>
            <div className="table-scroll import-preview">
              <table>
                <thead>
                  <tr>
                    <th>{tr('import:date')}</th>
                    <th>{tr('import:suppliedFields')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{Object.keys(row.fields).map(fieldName).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="check-label">
              <Trans
                i18nKey="import:iReviewedTheDestinationFieldsAndExistingDayPolicy"
                components={{
                  slot0: (
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={busy}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                  ),
                }}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || !confirmed || !session.data}
              onClick={() => void run()}
            >
              {busy
                ? tr('import:importing', { value0: results.length, value1: rows.length })
                : tr('import:importReviewedObservations')}
            </button>
            {busy && (
              <button
                className="button secondary"
                onClick={() => {
                  stopped.current = true;
                }}
              >
                {tr('import:stopImport')}
              </button>
            )}
            <p className="small muted">{tr('import:eachDayIsSavedSeparatelyWithARevisionCheck')}</p>
          </Panel>
          {results.length > 0 && (
            <Panel title={tr('import:importResults')}>
              <div role="status">
                <Trans
                  i18nKey="import:daysSavedSkippedFailed"
                  components={{
                    slot0: (
                      <MessageValue
                        value={
                          results.filter((r) => ['created', 'merged'].includes(r.status)).length
                        }
                      />
                    ),
                    slot1: (
                      <MessageValue value={results.filter((r) => r.status === 'skipped').length} />
                    ),
                    slot2: (
                      <MessageValue
                        value={
                          results.filter(
                            (r) => !['created', 'merged', 'skipped'].includes(r.status),
                          ).length
                        }
                      />
                    ),
                  }}
                />
              </div>
              <div className="table-scroll import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>{tr('import:date')}</th>
                      <th>{tr('import:result')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>
                          {r.status === 'created'
                            ? tr('import:created')
                            : r.status === 'merged'
                              ? tr('import:mergedSelectedFields')
                              : r.status === 'skipped'
                                ? tr('import:skippedExistingDay')
                                : tr('import:notImported', { value0: errorText(r.error) })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
