import { metrics } from './metrics';
import { featureCatalog } from './features';
import { z } from 'zod';
import { workoutTypes } from './activities';
import { habitKeySchema, type HabitDefinition, type HabitRecord } from './habits';
import { emptyEntry, symptomTypes, type Entry } from './schema';

export const checkInFields = {
  ratings: [
    'wellbeing',
    'energy',
    'motivation',
    'fatigue',
    'stress',
    'soreness',
    'labels',
    'notes',
  ],
  sleep: [
    'sleep.durationMinutes',
    'sleep.bedtime',
    'sleep.wakeTime',
    'sleep.latencyMinutes',
    'sleep.awakenings',
    'sleep.score',
    'sleep.quality',
    'sleepNotes',
    'physiology.hrv',
    'physiology.restingHeartRate',
    'physiology.respiratoryRate',
    'physiology.temperatureC',
    'physiology.weightKg',
    'illnessSeverity',
    'symptoms',
    'illnessNotes',
  ],
  training: ['trainingStatus'],
} as const;
export const fieldIds = [
  ...checkInFields.ratings,
  ...checkInFields.sleep,
  ...checkInFields.training,
];
export type CheckInField = (typeof fieldIds)[number];
export const choiceLists = [
  'activity',
  'habit',
  'symptom',
  'source',
  'hrvMethod',
  'label',
  'trainingStatus',
  'metric',
  'feature',
] as const;
export type ChoiceList = (typeof choiceLists)[number];
export const preferenceChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), id: z.enum(fieldIds), visible: z.boolean() }).strict(),
  z.object({ kind: z.literal('habit'), key: habitKeySchema, enabled: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal('choice'),
      list: z.enum(choiceLists),
      value: z.string().trim().min(1).max(120),
    })
    .strict()
    .refine(({ list, value }) => {
      switch (list) {
        case 'activity':
          return (workoutTypes as readonly string[]).includes(value);
        case 'habit':
          return habitKeySchema.safeParse(value).success;
        case 'symptom':
          return (symptomTypes as readonly string[]).includes(value);
        case 'source':
          return ['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'].includes(value);
        case 'hrvMethod':
          return ['unknown', 'rmssd', 'sdnn'].includes(value);
        case 'trainingStatus':
          return ['unrecorded', 'rest', 'trained'].includes(value);
        case 'label':
          return value.length <= 40;
        case 'metric':
          return Object.hasOwn(metrics, value);
        case 'feature': {
          if (featureCatalog().some((feature) => feature.id === value)) return true;
          if (value.startsWith('label:')) return value.length > 6 && value.length <= 46;
          const match = value.match(/^habit:(.+):(count|duration|timeSin|timeCos)$/);
          return !!match && habitKeySchema.safeParse(match[1]).success;
        }
      }
    }),
]);
export type PreferenceChange = z.infer<typeof preferenceChangeSchema>;
export type PreferenceRow = { key: string; payload: string; uses: number; last_used: number };
export type ChoiceUsage = { list: ChoiceList; value: string; count: number; lastUsed: number };
export type Preferences = {
  fields: Partial<Record<CheckInField, boolean>>;
  habits: string[];
  usage: ChoiceUsage[];
};
export const emptyPreferences = (): Preferences => ({ fields: {}, habits: [], usage: [] });
export function preferenceKey(change: PreferenceChange) {
  if (change.kind === 'field') return `field:${change.id}`;
  if (change.kind === 'habit') return `habit:${change.key}`;
  return `choice:${change.list}:${change.value}`;
}
export function mergePreference(prefs: Preferences, row: PreferenceRow): Preferences {
  const change = preferenceChangeSchema.parse(JSON.parse(row.payload));
  if (change.kind === 'field')
    return { ...prefs, fields: { ...prefs.fields, [change.id]: change.visible } };
  if (change.kind === 'habit')
    return {
      ...prefs,
      habits: [
        ...prefs.habits.filter((key) => key !== change.key),
        ...(change.enabled ? [change.key] : []),
      ],
    };
  return {
    ...prefs,
    usage: [
      ...prefs.usage.filter((item) => item.list !== change.list || item.value !== change.value),
      { list: change.list, value: change.value, count: row.uses, lastUsed: row.last_used },
    ],
  };
}
export function preferencesFromRows(rows: PreferenceRow[]) {
  return rows.reduce(mergePreference, emptyPreferences());
}
/** Recent choices first, frequency breaks timestamp ties; original order is the final tie-break. */
export function rankChoices<T>(
  items: readonly T[],
  list: ChoiceList,
  prefs: Preferences,
  key: (item: T) => string,
): T[] {
  const usage = new Map(prefs.usage.filter((u) => u.list === list).map((u) => [u.value, u]));
  return items
    .map((item, index) => ({ item, index, used: usage.get(key(item)) }))
    .sort(
      (a, b) =>
        (b.used?.lastUsed ?? -1) - (a.used?.lastUsed ?? -1) ||
        (b.used?.count ?? 0) - (a.used?.count ?? 0) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}
export function fieldRecorded(entry: Entry, field: CheckInField): boolean {
  if (field === 'trainingStatus')
    return entry.trainingStatus !== 'unrecorded' || entry.workouts.length > 0;
  const [group, key] = field.split('.');
  const record = entry as unknown as Record<string, unknown>;
  const value = key ? (record[group] as Record<string, unknown>)[key] : record[group];
  if (field === 'labels') return value != null;
  return Array.isArray(value)
    ? value.length > 0
    : value !== null && value !== '' && value !== undefined;
}
/** Templates contain identities only: no counts, times, durations or notes are copied. */
export function routineHabits(prefs: Preferences, definitions: HabitDefinition[]): HabitRecord[] {
  const library = new Map(definitions.filter((d) => !d.archived).map((d) => [d.key, d]));
  return rankChoices(prefs.habits, 'habit', prefs, (key) => key)
    .flatMap((key) => {
      if (key.startsWith('custom:') && !library.has(key)) return [];
      return [
        {
          key,
          name: library.get(key)?.name ?? null,
          count: null,
          times: [],
          durationMinutes: null,
          notes: '',
        },
      ];
    })
    .slice(0, 100);
}

export function personalizedEntry(
  date: string,
  prefs: Preferences,
  definitions: HabitDefinition[],
): Entry {
  const entry = emptyEntry(date);
  entry.habits = routineHabits(prefs, definitions);
  entry.physiology.source = rankChoices(
    ['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'] as const,
    'source',
    prefs,
    (value) => value,
  )[0];
  entry.physiology.hrvMethod = rankChoices(
    ['unknown', 'rmssd', 'sdnn'] as const,
    'hrvMethod',
    prefs,
    (value) => value,
  )[0];
  return entry;
}

/** On first use, unselected ratings opt out; explicit layout choices always take precedence. */
export function initialRatingChoices(entry: Entry, prefs: Preferences): PreferenceChange[] {
  const fields: CheckInField[] = [
    'wellbeing',
    'energy',
    'motivation',
    'fatigue',
    'stress',
    'soreness',
    'illnessSeverity',
    'sleep.quality',
  ];
  return fields
    .filter((id) => prefs.fields[id] === undefined)
    .map((id) => ({ kind: 'field', id, visible: fieldRecorded(entry, id) }));
}
