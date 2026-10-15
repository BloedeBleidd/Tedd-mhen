import { useEffect, useState } from 'react';
import { Check, Download, FileJson, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-react';
import { useApi, useLoad, download } from '../lib/api';
import { dayNumber, localDate, shiftDate } from '../../shared/schema';
import {
  allowedExportFields,
  csvCell,
  exportDictionary,
  exportFieldOptions,
  exportGroups,
  flatten,
  markdownEntry,
  selectFields,
  type ExportFormat,
  type ExportGroup,
} from '../../shared/export';
import { ErrorBox, Field, PageHeading, Panel } from '../components/ui';
const groupInfo: Record<ExportGroup, { title: string; description: string }> = {
  ratings: {
    title: 'Daily ratings',
    description: 'Wellbeing, energy, motivation, fatigue, stress, soreness, illness severity',
  },
  sleep: {
    title: 'Sleep',
    description: 'Duration, timing, latency, awakenings, device score, perceived quality',
  },
  physiology: {
    title: 'Body signals',
    description: 'HRV, measurement method & source, heart rate, breathing, temperature, weight',
  },
  symptoms: { title: 'Symptoms', description: 'Specific symptoms and their numerical severity' },
  workouts: {
    title: 'Training sessions',
    description:
      'Activity, duration, distance, effort, pain, heart rate, strength sets, rest status',
  },
  context: {
    title: 'Context labels',
    description: 'Structured labels, including explicitly no labels or unrecorded context',
  },
  notes: {
    title: 'Written context',
    description: 'Daily, sleep, illness, and workout notes · may contain personal details',
  },
};
export function Export() {
  const { demo, getDemoEntries } = useApi();
  const [from, setFrom] = useState(shiftDate(localDate(), -89)),
    [to, setTo] = useState(localDate()),
    [groups, setGroups] = useState<ExportGroup[]>([
      'ratings',
      'sleep',
      'physiology',
      'symptoms',
      'workouts',
    ]),
    [format, setFormat] = useState<ExportFormat>('json'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState(false);
  const valid = !!from && !!to && from <= to && dayNumber(to) - dayNumber(from) <= 1830;
  useEffect(() => {
    if (!busy) return;
    const preventSwitch = (event: Event) => event.preventDefault();
    window.addEventListener('teddmhen:mode-change', preventSwitch);
    return () => window.removeEventListener('teddmhen:mode-change', preventSwitch);
  }, [busy]);
  const [fields, setFields] = useState<string[]>(allowedExportFields);
  const selectedFields = fields.filter((field) =>
    groups.some((group) => exportFieldOptions[group].some((option) => option.path === field)),
  );
  const count = useLoad<{ total: number }>(
    valid ? `/api/entries?from=${from}&to=${to}&limit=1` : null,
  );
  function toggle(group: ExportGroup) {
    setGroups((g) => (g.includes(group) ? g.filter((x) => x !== group) : [...g, group]));
    setSuccess(false);
  }
  async function runExport() {
    setBusy(true);
    setError(null);
    setSuccess(false);
    const filename = `teddmhen-${demo ? 'demo-' : ''}${from}-${to}.${format}`;
    try {
      if (demo) {
        const rows = getDemoEntries()
          .filter((e) => e.date >= from && e.date <= to)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => selectFields(e, groups, selectedFields));
        const meta = {
          application: 'Tedd’mhen',
          synthetic: true,
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          dateRange: { from, to },
          groups,
          fields: selectedFields,
          count: rows.length,
          dictionary: exportDictionary,
        };
        let text = '';
        if (format === 'json') text = JSON.stringify({ ...meta, entries: rows }, null, 2);
        if (format === 'ndjson')
          text =
            [JSON.stringify({ _meta: meta }), ...rows.map((r) => JSON.stringify(r))].join('\n') +
            '\n';
        if (format === 'md')
          text =
            '# Tedd’mhen · Synthetic demonstration export\n' +
            markdownEntry({ date: 'Metadata', ...meta }) +
            rows.map(markdownEntry).join('');
        if (format === 'csv') {
          const flat = rows.map((r) => flatten(r)),
            keys = flat.length ? Object.keys(flat[0]) : ['date'];
          text =
            '\uFEFF' +
            [
              keys.map(csvCell).join(','),
              ...flat.map((r) => keys.map((k) => csvCell(r[k])).join(',')),
            ].join('\r\n');
        }
        download(
          text,
          filename,
          format === 'json' ? 'application/json' : 'text/plain;charset=utf-8',
        );
      } else {
        const picker = (
          window as unknown as {
            showSaveFilePicker?: (options: {
              suggestedName: string;
            }) => Promise<FileSystemFileHandle>;
          }
        ).showSaveFilePicker;
        const handle = picker ? await picker({ suggestedName: filename }) : null;
        const query = new URLSearchParams({
          from,
          to,
          format,
          groups: groups.join(','),
          fields: selectedFields.join(','),
        });
        const response = await fetch(`/api/export?${query}`);
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error || 'Export failed.');
        }
        if (!response.body) throw new Error('The export response was empty.');
        if (handle) {
          const writable = await handle.createWritable();
          await response.body.pipeTo(writable);
        } else {
          // Bound memory on browsers without a streaming file-save API.
          const reader = response.body.getReader(),
            chunks: Uint8Array<ArrayBuffer>[] = [];
          let length = 0;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > 64 * 1024 * 1024) {
              await reader.cancel();
              throw new Error(
                'This browser supports exports up to 64 MiB. Choose a smaller date range or use a Chromium browser for streaming exports.',
              );
            }
            chunks.push(new Uint8Array(value));
          }
          download(
            new Blob(chunks),
            filename,
            response.headers.get('Content-Type') || 'application/octet-stream',
          );
        }
      }
      setSuccess(true);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR DATA, YOUR NEXT STEP"
        title="Take the full picture with you."
        description="Build a focused dataset for your own analysis, a spreadsheet, or an external LLM."
      />
      <div className="export-layout">
        <div>
          <Panel title="01 · Choose a time window" subtitle="Export up to five years at a time.">
            <div className="fields-grid">
              <Field label="From">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setSuccess(false);
                  }}
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setSuccess(false);
                  }}
                />
              </Field>
            </div>
            <div className="quick-ranges">
              {[7, 28, 90, 365].map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    setFrom(shiftDate(localDate(), -(days - 1)));
                    setTo(localDate());
                    setSuccess(false);
                  }}
                >
                  Last {days} days
                </button>
              ))}
            </div>
          </Panel>
          <Panel
            title="02 · Select what to include"
            subtitle="Dates, time zones, schema version, and record timestamps are always included."
            action={
              <button
                className="text-link"
                onClick={() => setGroups(groups.length === 6 ? [] : [...exportGroups])}
              >
                {groups.length === 6 ? 'Clear all' : 'Select all'}
              </button>
            }
          >
            <div className="export-groups">
              {exportGroups.map((group) => (
                <label
                  key={group}
                  className={`export-group ${groups.includes(group) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={groups.includes(group)}
                    onChange={() => toggle(group)}
                  />
                  <span>
                    <strong>{groupInfo[group].title}</strong>
                    <small>{groupInfo[group].description}</small>
                  </span>
                  {groups.includes(group) && <Check size={17} />}
                </label>
              ))}
            </div>
            <details className="export-field-details">
              <summary>Choose individual measurements</summary>
              <p className="muted small">
                Keep source and HRV method selected when exporting HRV so the measurement remains
                interpretable.
              </p>
              {groups.map((group) => (
                <div className="export-field-group" key={group}>
                  <strong>{groupInfo[group].title}</strong>
                  <div className="export-field-options">
                    {exportFieldOptions[group].map((field) => (
                      <label key={field.path}>
                        <input
                          type="checkbox"
                          checked={fields.includes(field.path)}
                          onChange={() => {
                            setFields((current) =>
                              current.includes(field.path)
                                ? current.filter((path) => path !== field.path)
                                : [...current, field.path],
                            );
                            setSuccess(false);
                          }}
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </details>
          </Panel>
          <Panel title="03 · Choose a format">
            <div className="format-grid">
              {(
                [
                  {
                    key: 'json',
                    title: 'JSON',
                    detail: 'Complete, structured context',
                    icon: FileJson,
                  },
                  {
                    key: 'md',
                    title: 'Markdown',
                    detail: 'Easy to read and share with an LLM',
                    icon: FileText,
                  },
                  {
                    key: 'csv',
                    title: 'CSV',
                    detail: 'Spreadsheet-friendly columns',
                    icon: FileSpreadsheet,
                  },
                  { key: 'ndjson', title: 'NDJSON', detail: 'One record per line', icon: FileJson },
                ] as const
              ).map(({ key, title, detail, icon: Icon }) => (
                <label className={`format-option ${format === key ? 'selected' : ''}`} key={key}>
                  <input
                    type="radio"
                    name="format"
                    value={key}
                    checked={format === key}
                    onChange={() => {
                      setFormat(key);
                      setSuccess(false);
                    }}
                  />
                  <Icon size={22} />
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </label>
              ))}
            </div>
            {format === 'csv' && (
              <p className="muted small">
                Nested objects use dotted columns; workouts and symptoms remain JSON arrays in
                cells. CSV omits the data dictionary. Formula-like text is prefixed with an
                apostrophe for spreadsheet safety.
              </p>
            )}
          </Panel>
        </div>
        <aside>
          <Panel className="export-summary">
            <span className="eyebrow">READY TO TRAVEL</span>
            <div className="export-file-icon">
              <Download size={28} strokeWidth={1.3} />
            </div>
            <h2>
              Your journal,
              <br />
              in your hands.
            </h2>
            <dl>
              <div>
                <dt>Recorded days</dt>
                <dd>{count.loading ? '…' : (count.data?.total ?? '—')}</dd>
              </div>
              <div>
                <dt>Data groups</dt>
                <dd>{groups.length} of 6</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{format.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Written notes</dt>
                <dd>{groups.includes('notes') ? 'Included' : 'Excluded'}</dd>
              </div>
            </dl>
            <button
              className="button primary"
              disabled={
                !valid ||
                !groups.length ||
                !selectedFields.length ||
                busy ||
                !count.data?.total ||
                !!count.error
              }
              onClick={runExport}
            >
              <Download size={17} />
              {busy ? 'Preparing export…' : 'Download export'}
            </button>
            <div aria-live="polite">
              {success && (
                <p className="saved-state">
                  <Check size={16} /> Export prepared. Check your downloads.
                </p>
              )}
            </div>
            <p className="export-privacy">
              <ShieldCheck size={15} />
              The app never sends this export to an AI provider. You choose where it goes next.
            </p>
          </Panel>
          <div className="export-tip">
            <strong>A useful prompt starts with context.</strong>
            <p>
              Tell your LLM your goal, the measurement routine, and any changes in equipment. Ask it
              to distinguish observations from hypotheses and account for missing data.
            </p>
          </div>
        </aside>
      </div>
      <ErrorBox
        message={!valid ? 'Select a valid range of up to five years.' : error || count.error}
      />
    </>
  );
}
