import { scaleDefinitions, type StoredEntry } from './schema';
export const exportGroups = [
  'ratings',
  'sleep',
  'physiology',
  'symptoms',
  'workouts',
  'notes',
  'context',
] as const;
export type ExportGroup = (typeof exportGroups)[number];
export type ExportFormat = 'json' | 'csv' | 'md' | 'ndjson';
export const exportFieldOptions: Record<ExportGroup, { path: string; label: string }[]> = {
  ratings: Object.entries(scaleDefinitions).map(([path, value]) => ({ path, label: value.label })),
  sleep: [
    ['durationMinutes', 'Sleep duration'],
    ['bedtime', 'Bedtime'],
    ['wakeTime', 'Wake time'],
    ['latencyMinutes', 'Sleep latency'],
    ['awakenings', 'Awakenings'],
    ['score', 'Device sleep score'],
    ['quality', 'Perceived sleep quality'],
  ].map(([key, label]) => ({ path: `sleep.${key}`, label })),
  physiology: [
    ['hrv', 'HRV'],
    ['hrvMethod', 'HRV method'],
    ['restingHeartRate', 'Resting heart rate'],
    ['respiratoryRate', 'Respiratory rate'],
    ['temperatureC', 'Temperature'],
    ['weightKg', 'Body weight'],
    ['source', 'Measurement source'],
  ].map(([key, label]) => ({ path: `physiology.${key}`, label })),
  symptoms: [{ path: 'symptoms', label: 'Symptoms with severity' }],
  workouts: [
    { path: 'trainingStatus', label: 'Training / rest status' },
    { path: 'workouts', label: 'Structured training sessions' },
  ],
  context: [{ path: 'labels', label: 'Recorded context labels' }],
  notes: [
    { path: 'notes', label: 'Daily notes' },
    { path: 'sleepNotes', label: 'Sleep notes' },
    { path: 'illnessNotes', label: 'Illness notes' },
    { path: 'workoutNotes', label: 'Session notes (requires sessions)' },
  ],
};
export const allowedExportFields = Object.values(exportFieldOptions)
  .flat()
  .map((f) => f.path);
export const exportDictionary = {
  date: 'Local journal date (YYYY-MM-DD). Sleep belongs to the date of waking.',
  missing: 'null / blank means not recorded; zero is an observed value. No imputation.',
  ratings: Object.fromEntries(
    Object.entries(scaleDefinitions).map(([k, v]) => [
      k,
      `${v.min}–10: ${v.low} to ${v.high}; project-defined, not a validated clinical scale.`,
    ]),
  ),
  sleep:
    'durationMinutes = actual sleep, not time in bed; latencyMinutes in minutes; score 0–100 (device-specific); quality 1–10 (very poor to excellent); bedtime/wakeTime HH:mm in recorded timezone.',
  physiology:
    'hrv in ms with method; restingHeartRate in bpm; respiratoryRate in breaths/min; temperatureC in °C; weightKg in kg. Source and HRV methods must remain comparable.',
  symptoms:
    'severity 1–10, mild to severe. An empty symptoms list alone does not establish absence of illness.',
  workouts:
    'durationMinutes; distanceKm; effort 1–10 (very easy to maximal, project-defined); pain 0–10 (none to extreme); weights in kg. Load = sum(duration × effort); missing if effort or training status missing. Explicit rest = zero.',
  labels:
    'Structured context labels: null/absent = not recorded; [] = explicitly no labels; otherwise presence indicators. User-defined, not validated exposures.',
  notes: 'Optional self-reported narrative; not used by the statistical model.',
};
export function selectFields(
  entry: StoredEntry,
  groups: ExportGroup[],
  fields?: string[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    schemaVersion: 1,
    date: entry.date,
    timezone: entry.timezone,
    revision: entry.revision,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
  for (const group of groups) {
    if (group === 'ratings')
      for (const key of Object.keys(scaleDefinitions) as (keyof typeof scaleDefinitions)[])
        row[key] = entry[key];
    else if (group === 'context') row.labels = entry.labels ?? null;
    else if (group === 'notes') {
      row.notes = entry.notes;
      row.sleepNotes = entry.sleepNotes;
      row.illnessNotes = entry.illnessNotes;
    } else if (group === 'workouts') {
      row.trainingStatus = entry.trainingStatus;
      row.workouts = entry.workouts.map(({ notes, ...rest }) =>
        groups.includes('notes') && (!fields || fields.includes('workoutNotes'))
          ? { ...rest, notes }
          : rest,
      );
    } else row[group] = entry[group];
  }
  if (!fields) return row;
  const selected: Record<string, unknown> = Object.fromEntries(
    ['schemaVersion', 'date', 'timezone', 'revision', 'createdAt', 'updatedAt'].map((key) => [
      key,
      row[key],
    ]),
  );
  for (const path of fields) {
    if (!allowedExportFields.includes(path)) continue;
    const [parent, key] = path.split('.');
    if (key && row[parent] && typeof row[parent] === 'object') {
      const target = (selected[parent] ||= {}) as Record<string, unknown>;
      target[key] = (row[parent] as Record<string, unknown>)[key];
    } else if (parent in row) selected[parent] = row[parent];
  }
  return selected;
}
export function flatten(row: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, value]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(flatten(value as Record<string, unknown>, name))
        : [[name, Array.isArray(value) ? JSON.stringify(value) : value]];
    }),
  );
}
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text) && typeof value !== 'number') text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function markdownEntry(row: Record<string, unknown>): string {
  // Use a fence longer than any run in user text, so notes cannot close the data block.
  const json = JSON.stringify(row, null, 2);
  let fenceLength = 3;
  for (const match of json.matchAll(/`+/g))
    fenceLength = Math.max(fenceLength, match[0].length + 1);
  const fence = '`'.repeat(fenceLength);
  return `\n## ${row.date}\n\n${fence}json\n${json}\n${fence}\n`;
}
