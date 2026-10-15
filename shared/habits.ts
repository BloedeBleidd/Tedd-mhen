import { z } from 'zod';

export const habitPresets = [
  'reading_before_bed',
  'screen_free_before_bed',
  'blue_light_filter_evening',
  'morning_daylight',
  'cold_shower_morning',
  'cold_shower_evening',
  'sauna',
  'meditation',
  'breathing_practice',
  'journaling',
  'gratitude_practice',
  'time_in_nature',
  'social_time',
  'daytime_nap',
  'stretch_break',
  'standing_break',
  'caffeine',
  'caffeine_evening',
  'alcohol',
  'cigarettes',
  'vaping',
  'nicotine_pouches',
  'cannabis',
  'masturbation',
  'sexual_activity',
  'nail_biting',
  'skin_picking',
  'hair_pulling',
  'late_meal',
  'mindful_meal',
  'flossing',
  'brushing_teeth',
  'language_practice',
  'music_practice',
  'creative_work',
  'gaming',
  'social_media',
  'outdoor_walk',
  'volunteering',
  'therapy_session',
] as const;
export type HabitPreset = (typeof habitPresets)[number];
export const customHabitKey = z
  .string()
  .regex(/^custom:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
export const habitKeySchema = z.union([
  z.enum(habitPresets.map((id) => `preset:${id}` as const)),
  customHabitKey,
]);
export const habitNameSchema = z.string().trim().min(1).max(120);
export const habitDefinitionSchema = z
  .object({
    key: customHabitKey,
    name: habitNameSchema,
    archived: z.boolean().default(false),
  })
  .strict();
export type HabitDefinition = z.infer<typeof habitDefinitionSchema>;
export const habitRecordSchema = z
  .object({
    key: habitKeySchema,
    name: habitNameSchema.nullable(),
    count: z.number().int().min(0).max(100_000).nullable(),
    times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(500),
    durationMinutes: z.number().finite().min(0).max(1440).nullable(),
    notes: z.string().max(50_000).default(''),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.key.startsWith('custom:') !== (record.name !== null))
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'Custom activities need a name; preset names come from the catalog.',
      });
    if (record.count !== null && record.times.length > record.count)
      ctx.addIssue({
        code: 'custom',
        path: ['times'],
        message: 'Recorded times cannot exceed the daily count.',
      });
    if (record.count === 0 && (record.durationMinutes ?? 0) > 0)
      ctx.addIssue({
        code: 'custom',
        path: ['durationMinutes'],
        message: 'A zero count cannot have a positive duration.',
      });
  });
export const habitsSchema = z
  .array(habitRecordSchema)
  .max(100)
  .default([])
  .refine(
    (items) => new Set(items.map((item) => item.key)).size === items.length,
    'Record each habit only once per day; combine its events in that row.',
  );
export type HabitRecord = z.infer<typeof habitRecordSchema>;
export type HabitSummary = Omit<HabitRecord, 'notes'>;
export const habitMeasures = ['count', 'duration', 'timeSin', 'timeCos'] as const;
export type HabitMeasure = (typeof habitMeasures)[number];
export function habitValue(record: HabitSummary | undefined, measure: HabitMeasure): number | null {
  if (!record) return null;
  if (measure === 'count') return record.count;
  if (measure === 'duration') return record.durationMinutes;
  if (!record.count || record.times.length !== record.count) return null;
  return (
    record.times.reduce((sum, time) => {
      const [hours, minutes] = time.split(':').map(Number);
      const angle = (2 * Math.PI * (hours * 60 + minutes)) / 1440;
      return sum + (measure === 'timeSin' ? Math.sin(angle) : Math.cos(angle));
    }, 0) / record.count
  );
}
/** Structured display metadata distinguishes custom names from translatable preset identifiers. */
export const habitFeatureLabel = (
  record: Pick<HabitSummary, 'key' | 'name'>,
  measure: HabitMeasure,
) => `Habit: ${JSON.stringify({ key: record.key, name: record.name, measure })}`;
