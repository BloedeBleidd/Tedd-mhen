import { habitsSchema, type HabitSummary } from './habits';
import { workoutTypes } from './activities';
import { z } from 'zod';

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value;
  }, 'Use a valid calendar date.');
const optionalNumber = (min: number, max: number, integer = false) => {
  const base = z.number().finite().min(min).max(max);
  return (integer ? base.int() : base).nullable();
};
const rating = optionalNumber(1, 10, true);
const burden = optionalNumber(0, 10, true);
const note = z.string().max(50_000);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();
export { workoutTypes } from './activities';
export const symptomTypes = [
  'headache',
  'sore_throat',
  'cough',
  'congestion',
  'feverish',
  'digestive',
  'dizziness',
  'other',
] as const;
export const workoutSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(workoutTypes),
    title: z.string().max(120),
    durationMinutes: z.number().finite().positive().max(1440),
    distanceKm: optionalNumber(0, 1000),
    effort: rating,
    pain: burden,
    averageHeartRate: optionalNumber(25, 250, true),
    sets: z
      .array(
        z.object({
          exercise: z.string().min(1).max(120),
          sets: z.number().int().min(1).max(100),
          reps: z.number().int().min(1).max(1000),
          weightKg: z.number().min(0).max(1000),
        }),
      )
      .max(100),
    notes: note,
  })
  .strict();
export const entrySchema = z
  .object({
    schemaVersion: z.literal(1),
    date: dateSchema,
    timezone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Use a valid IANA time zone.'),
    wellbeing: rating,
    energy: rating,
    motivation: rating,
    fatigue: burden,
    stress: burden,
    soreness: burden,
    illnessSeverity: burden,
    habits: habitsSchema,
    labels: z
      .array(z.string().trim().min(1).max(40))
      .max(12)
      .refine((items) => new Set(items).size === items.length, 'Duplicate context label.')
      .nullable()
      .default(null),
    symptoms: z
      .array(
        z
          .object({ name: z.enum(symptomTypes), severity: z.number().int().min(1).max(10) })
          .strict(),
      )
      .max(8)
      .refine(
        (items) => new Set(items.map((item) => item.name)).size === items.length,
        'Duplicate symptom.',
      ),
    sleep: z
      .object({
        durationMinutes: optionalNumber(0, 1440, true),
        bedtime: time,
        wakeTime: time,
        latencyMinutes: optionalNumber(0, 720, true),
        awakenings: optionalNumber(0, 100, true),
        score: optionalNumber(0, 100, true),
        quality: rating,
      })
      .strict(),
    physiology: z
      .object({
        hrv: optionalNumber(1, 500),
        hrvMethod: z.enum(['rmssd', 'sdnn', 'unknown']),
        restingHeartRate: optionalNumber(20, 250, true),
        respiratoryRate: optionalNumber(3, 60),
        temperatureC: optionalNumber(30, 45),
        weightKg: optionalNumber(20, 400),
        source: z.enum(['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other']),
      })
      .strict(),
    trainingStatus: z.enum(['unrecorded', 'rest', 'trained']),
    workouts: z.array(workoutSchema).max(20),
    notes: note,
    sleepNotes: note,
    illnessNotes: note,
  })
  .strict()
  .superRefine((entry, context) => {
    if (new Set(entry.workouts.map((workout) => workout.id)).size !== entry.workouts.length)
      context.addIssue({
        code: 'custom',
        path: ['workouts'],
        message: 'Each training session must have a unique identifier.',
      });
    if (entry.workouts.reduce((minutes, workout) => minutes + workout.durationMinutes, 0) > 1440)
      context.addIssue({
        code: 'custom',
        path: ['workouts'],
        message: 'Total training duration cannot exceed 24 hours per day.',
      });
    if (entry.trainingStatus === 'trained' && entry.workouts.length === 0)
      context.addIssue({
        code: 'custom',
        path: ['workouts'],
        message: 'Add a workout or select rest / not recorded.',
      });
    if (entry.trainingStatus !== 'trained' && entry.workouts.length > 0)
      context.addIssue({
        code: 'custom',
        path: ['trainingStatus'],
        message: 'Days with workouts must be marked as trained.',
      });
    if (entry.illnessSeverity === 0 && entry.symptoms.length)
      context.addIssue({
        code: 'custom',
        path: ['illnessSeverity'],
        message: 'Symptoms require illness severity above zero or left unrecorded.',
      });
  });
export type Entry = z.infer<typeof entrySchema>;
export type Workout = z.infer<typeof workoutSchema>;
export type StoredEntry = Entry & { revision: number; createdAt: string; updatedAt: string };
export type EntrySummary = Omit<
  StoredEntry,
  'notes' | 'sleepNotes' | 'illnessNotes' | 'workouts' | 'habits'
> & {
  habits: HabitSummary[];
  workoutCount: number;
  workoutTypes: string[];
  trainingMinutes: number | null;
  trainingLoad: number | null;
};
export type JournalPage = {
  entries: EntrySummary[];
  total: number;
  nextCursor: string | null;
  firstDate: string | null;
  lastDate: string | null;
};
export const scaleDefinitions = {
  wellbeing: { label: 'Wellbeing', min: 1, low: 'Very poor', high: 'Excellent' },
  energy: { label: 'Energy', min: 1, low: 'Depleted', high: 'Full of energy' },
  motivation: { label: 'Motivation', min: 1, low: 'None', high: 'Very high' },
  fatigue: { label: 'Fatigue', min: 0, low: 'None', high: 'Extreme' },
  stress: { label: 'Stress', min: 0, low: 'None', high: 'Extreme' },
  soreness: { label: 'Muscle soreness', min: 0, low: 'None', high: 'Extreme' },
  illnessSeverity: { label: 'Illness severity', min: 0, low: 'No illness', high: 'Severe' },
} as const;
export type ScaleKey = keyof typeof scaleDefinitions;
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
export function emptyEntry(date = localDate()): Entry {
  return {
    schemaVersion: 1,
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    wellbeing: null,
    energy: null,
    motivation: null,
    fatigue: null,
    stress: null,
    soreness: null,
    illnessSeverity: null,
    labels: null,
    habits: [],
    symptoms: [],
    sleep: {
      durationMinutes: null,
      bedtime: null,
      wakeTime: null,
      latencyMinutes: null,
      awakenings: null,
      score: null,
      quality: null,
    },
    physiology: {
      hrv: null,
      hrvMethod: 'unknown',
      restingHeartRate: null,
      respiratoryRate: null,
      temperatureC: null,
      weightKg: null,
      source: 'manual',
    },
    trainingStatus: 'unrecorded',
    workouts: [],
    notes: '',
    sleepNotes: '',
    illnessNotes: '',
  };
}
export function summarize(entry: StoredEntry): EntrySummary {
  const { notes: _notes, sleepNotes: _sleep, illnessNotes: _illness, workouts, ...rest } = entry;
  return {
    ...rest,
    habits: (entry.habits || []).map(({ notes: _habitNotes, ...record }) => record),
    workoutCount: workouts.length,
    workoutTypes: [...new Set(workouts.map((w) => w.type))],
    trainingMinutes:
      entry.trainingStatus === 'unrecorded'
        ? null
        : workouts.reduce((s, w) => s + w.durationMinutes, 0),
    trainingLoad:
      entry.trainingStatus === 'unrecorded' || workouts.some((w) => w.effort === null)
        ? null
        : workouts.reduce((s, w) => s + w.durationMinutes * w.effort!, 0),
  };
}
