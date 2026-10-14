import { useEffect, useRef, useState } from 'react';
import { ApiError, useApi, useLoad } from '../lib/api';
import { parseImport, mergeImported, IMPORT_MAX_BYTES, type ImportRow } from '../../shared/import';
import type { StoredEntry } from '../../shared/schema';
import { ErrorBox, Field, PageHeading, Panel } from '../components/ui';
export function Import() {
  const { request, invalidate, demo } = useApi(),
    session = useLoad<{ id: string; email: string }>('/api/session');
  const [rows, setRows] = useState<ImportRow[]>([]),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [mode, setMode] = useState<'skip' | 'merge'>('skip'),
    [busy, setBusy] = useState(false),
    [results, setResults] = useState<{ date: string; status: string }[]>([]),
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
    const preventModeChange = (event: Event) => event.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('teddmhen:mode-change', preventModeChange);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('teddmhen:mode-change', preventModeChange);
    };
  }, [busy]);
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
      setError(e instanceof Error ? e.message : 'Could not read this file.');
    }
  }
  async function run() {
    if (!confirmed || !rows.length || !session.data) return;
    setBusy(true);
    stopped.current = false;
    setError('');
    const completed: { date: string; status: string }[] = [];
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
          completed.push({ date: row.date, status: 'Skipped existing day' });
        } else {
          const entry = mergeImported(row, existing);
          await request(`/api/entries/${row.date}`, {
            method: 'PUT',
            headers: { 'X-Teddmhen-Expected-User': session.data.id },
            body: JSON.stringify({ entry, revision: existing?.revision ?? 0 }),
          });
          completed.push({
            date: row.date,
            status: existing ? 'Merged selected fields' : 'Created',
          });
        }
      } catch (e) {
        completed.push({
          date: row.date,
          status: `Not imported: ${e instanceof Error ? e.message : 'request failed'}`,
        });
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setError(
            'Import stopped because account access changed. Completed rows are listed below.',
          );
          break;
        }
      }
      setResults([...completed]);
    }
    setResults(completed);
    setBusy(false);
    setConfirmed(false);
    if (stopped.current)
      setError(
        'Import stopped. Completed saves remain in your journal; review the results before retrying.',
      );
    invalidate();
  }
  return (
    <>
      <PageHeading
        eyebrow="BRING YOUR HISTORY"
        title="Import journal observations."
        description="Preview a compatible export, choose how to handle existing days, then save into your own account."
      />
      <Panel title="Choose a file">
        <p>
          JSON and NDJSON preserve types and text best. CSV supports Tedd’mhen column names, quoted
          multiline text and nested JSON arrays. Formula-protection apostrophes in CSV remain
          intact; use JSON for an exact round trip.
        </p>
        <Field label="Journal export file">
          <input
            type="file"
            accept=".json,.ndjson,.jsonl,.csv"
            disabled={busy}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </Field>
        <p className="small muted">
          Up to 500 days / 20 MiB per file. File content stays in the browser until you confirm.
          Account IDs and source revisions are never imported. Markdown and analysis-model downloads
          are reports, not journal backups.
        </p>
        <ErrorBox message={error || null} />
      </Panel>
      {rows.length > 0 && (
        <>
          <Panel title={`${rows.length} days ready for review`} subtitle={name}>
            <p>
              Destination: <strong>{demo ? 'Synthetic demo memory' : session.data?.email}</strong>.
              Missing fields stay unchanged on existing days; on new days they remain unknown or
              empty context. Supplied fields replace their corresponding values, including explicit
              nulls. A supplied workout list replaces the day’s sessions; omitted notes are
              preserved for matching session IDs.
            </p>
            <Field label="Existing-day policy">
              <select
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  setMode(e.target.value as 'skip' | 'merge');
                  setConfirmed(false);
                }}
              >
                <option value="skip">Skip existing days</option>
                <option value="merge">Merge only supplied fields into existing days</option>
              </select>
            </Field>
            <div className="table-scroll import-preview">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplied fields</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{Object.keys(row.fields).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed the destination, fields and existing-day policy.
            </label>
            <button
              className="button primary"
              disabled={busy || !confirmed || !session.data}
              onClick={() => void run()}
            >
              {busy
                ? `Importing · ${results.length} / ${rows.length}`
                : 'Import reviewed observations'}
            </button>
            {busy && (
              <button
                className="button secondary"
                onClick={() => {
                  stopped.current = true;
                }}
              >
                Stop import
              </button>
            )}
            <p className="small muted">
              Each day is saved separately with a revision check. Concurrent edits are reported as
              conflicts and never overwritten automatically. Partial completion is possible if a
              request fails. Stop import or leaving this page stops further rows; a save already
              sent can still finish. Retry with Skip existing days to preserve completed saves.
            </p>
          </Panel>
          {results.length > 0 && (
            <Panel title="Import results">
              <div role="status">
                {
                  results.filter((r) => ['Created', 'Merged selected fields'].includes(r.status))
                    .length
                }{' '}
                days saved · {results.filter((r) => r.status === 'Skipped existing day').length}{' '}
                skipped · {results.filter((r) => r.status.startsWith('Not imported')).length} failed
              </div>
              <div className="table-scroll import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>{r.status}</td>
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
