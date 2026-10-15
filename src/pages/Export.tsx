import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { localize, t as tr } from '../i18n';
import { useState } from 'react';
import { Check, Download, FileJson, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-react';
import { useApi, useLoad, download } from '../lib/api';
import { dateSchema, dayNumber, localDate, shiftDate, type JournalPage } from '../../shared/schema';
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
  useTranslation();
  const { demo, getDemoEntries, response: getResponse } = useApi();
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
  const valid =
    dateSchema.safeParse(from).success &&
    dateSchema.safeParse(to).success &&
    from <= to &&
    dayNumber(to) - dayNumber(from) <= 1830;
  const journal = useLoad<JournalPage>('/api/entries?limit=1');
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
    if (busy || !valid || !count.data?.total || !selectedFields.length) return;
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
            markdownEntry({ date: tr('export:metadata'), ...meta }) +
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
        let handle: FileSystemFileHandle | null = null;
        if (picker) {
          try {
            handle = await picker({ suggestedName: filename });
          } catch (cause) {
            if (
              !(cause instanceof DOMException) ||
              !['SecurityError', 'NotAllowedError'].includes(cause.name)
            )
              throw cause;
          }
        }
        const query = new URLSearchParams({
          from,
          to,
          format,
          groups: groups.join(','),
          fields: selectedFields.join(','),
        });
        const response = await getResponse(`/api/export?${query}`);
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
        eyebrow={tr('export:yourDataYourNextStep')}
        title={tr('export:takeTheFullPictureWithYou')}
        description={tr('export:buildAFocusedDatasetForYourOwnAnalysisA')}
      />
      <fieldset className="form-fieldset" disabled={busy}>
        <Panel title={tr('export:keepACompleteCopy')}>
          <p>{tr('export:chooseAllMeasurementsLabelsAndNotesInJsonFor')}</p>
          <button
            className="button secondary"
            onClick={() => {
              setGroups([...exportGroups]);
              setFields([...allowedExportFields]);
              setFormat('json');
              setSuccess(false);
              const { firstDate, lastDate } = journal.data || {};
              if (firstDate && lastDate && dayNumber(lastDate) - dayNumber(firstDate) <= 1830) {
                setFrom(firstDate);
                setTo(lastDate);
              }
            }}
          >
            {tr('export:selectCompleteJsonBackup')}
          </button>
        </Panel>
        <div className="export-layout">
          <div>
            <Panel
              title={tr('export:01ChooseATimeWindow')}
              subtitle={tr('export:exportUpToFiveYearsAtATime')}
            >
              <div className="fields-grid">
                <Field label={tr('export:from')}>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setSuccess(false);
                    }}
                  />
                </Field>
                <Field label={tr('export:to')}>
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
                    <Trans
                      i18nKey="export:lastDays"
                      components={{ slot0: <MessageValue value={days} /> }}
                    />
                  </button>
                ))}
              </div>
            </Panel>
            <Panel
              title={tr('export:02SelectWhatToInclude')}
              subtitle={tr('export:datesTimeZonesSchemaVersionAndRecordTimestampsAre')}
              action={
                <button
                  className="text-link"
                  onClick={() =>
                    setGroups(groups.length === exportGroups.length ? [] : [...exportGroups])
                  }
                >
                  {groups.length === exportGroups.length
                    ? tr('export:clearAll')
                    : tr('export:selectAll')}
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
                      <strong>{localize(groupInfo[group].title)}</strong>
                      <small>{localize(groupInfo[group].description)}</small>
                    </span>
                    {groups.includes(group) && <Check size={17} />}
                  </label>
                ))}
              </div>
              <details className="export-field-details">
                <summary>{tr('export:chooseIndividualMeasurements')}</summary>
                <p className="muted small">
                  {tr('export:keepSourceAndHrvMethodSelectedWhenExportingHrv')}
                </p>
                {groups.map((group) => (
                  <div className="export-field-group" key={group}>
                    <strong>{localize(groupInfo[group].title)}</strong>
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
                          {localize(field.label)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </details>
            </Panel>
            <Panel title={tr('export:03ChooseAFormat')}>
              <div className="format-grid">
                {(
                  [
                    {
                      key: 'json',
                      title: 'JSON',
                      detail: tr('export:completeStructuredContext'),
                      icon: FileJson,
                    },
                    {
                      key: 'md',
                      title: tr('export:markdown'),
                      detail: tr('export:easyToReadAndShareWithAnLlm'),
                      icon: FileText,
                    },
                    {
                      key: 'csv',
                      title: 'CSV',
                      detail: tr('export:spreadsheetFriendlyColumns'),
                      icon: FileSpreadsheet,
                    },
                    {
                      key: 'ndjson',
                      title: 'NDJSON',
                      detail: tr('export:oneRecordPerLine'),
                      icon: FileJson,
                    },
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
                  {tr('export:nestedObjectsUseDottedColumnsWorkoutsAndSymptomsRemain')}
                </p>
              )}
            </Panel>
          </div>
          <aside>
            <Panel className="export-summary">
              <span className="eyebrow">{tr('export:readyToTravel')}</span>
              <div className="export-file-icon">
                <Download size={28} strokeWidth={1.3} />
              </div>
              <h2>
                <Trans i18nKey="export:yourJournalInYourHands" components={{ slot0: <br /> }} />
              </h2>
              <dl>
                <div>
                  <dt>{tr('export:recordedDays')}</dt>
                  <dd>{count.loading ? '…' : (count.data?.total ?? '—')}</dd>
                </div>
                <div>
                  <dt>{tr('export:dataGroups')}</dt>
                  <dd>
                    <Trans
                      i18nKey="export:of"
                      components={{
                        slot0: <MessageValue value={groups.length} />,
                        slot1: <MessageValue value={exportGroups.length} />,
                      }}
                    />
                  </dd>
                </div>
                <div>
                  <dt>{tr('export:format')}</dt>
                  <dd>{format.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>{tr('export:writtenNotes')}</dt>
                  <dd>
                    {groups.includes('notes') ? tr('export:included') : tr('export:excluded')}
                  </dd>
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
                {busy ? tr('export:preparingExport') : tr('export:downloadExport')}
              </button>
              <ErrorBox
                message={
                  !valid ? tr('export:selectAValidRangeOfUpToFiveYears') : error || count.error
                }
              />
              {!count.loading && valid && !count.error && !count.data?.total && (
                <p role="status">{tr('export:noRecordedDaysInThisRangeChooseDatesContaining')}</p>
              )}
              {(!groups.length || !selectedFields.length) && (
                <p role="status">{tr('export:selectAtLeastOneMeasurementToExport')}</p>
              )}
              {(count.data?.total ?? 0) > 500 && (
                <p className="small">{tr('export:thisExportExceedsThe500DayImportLimitFor')}</p>
              )}
              <div aria-live="polite">
                {success && (
                  <p className="saved-state">
                    <Trans
                      i18nKey="export:exportPreparedCheckYourDownloads"
                      components={{ slot0: <Check size={16} /> }}
                    />
                  </p>
                )}
              </div>
              <p className="export-privacy">
                <Trans
                  i18nKey="export:theAppNeverSendsThisExportToAnAi"
                  components={{ slot0: <ShieldCheck size={15} /> }}
                />
              </p>
            </Panel>
            <div className="export-tip">
              <strong>{tr('export:aUsefulPromptStartsWithContext')}</strong>
              <p>{tr('export:tellYourLlmYourGoalTheMeasurementRoutineAnd')}</p>
            </div>
          </aside>
        </div>
      </fieldset>
    </>
  );
}
