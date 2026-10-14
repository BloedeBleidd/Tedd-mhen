import { describe, expect, it } from 'vitest';
import {
  dateSchema,
  emptyEntry,
  entrySchema,
  shiftDate,
  summarize,
  type StoredEntry,
} from '../shared/schema';
const stored = (): StoredEntry => ({
  ...emptyEntry('2026-10-14'),
  revision: 1,
  createdAt: '',
  updatedAt: '',
});
describe('Journal semantics', () => {
  it('preserves missing ratings and distinguishes explicit rest from unknown training', () => {
    const entry = stored();
    expect(entrySchema.parse(entrySchema.parse(emptyEntry())).wellbeing).toBeNull();
    expect(summarize(entry).trainingLoad).toBeNull();
    entry.trainingStatus = 'rest';
    expect(summarize(entry).trainingLoad).toBe(0);
    expect(summarize(entry).trainingMinutes).toBe(0);
  });
  it('rejects impossible dates, out-of-range ratings, and contradictory training', () => {
    expect(dateSchema.safeParse('2026-02-29').success).toBe(false);
    expect(dateSchema.safeParse('2024-02-29').success).toBe(true);
    expect(entrySchema.safeParse({ ...emptyEntry(), wellbeing: 0 }).success).toBe(false);
    expect(entrySchema.safeParse({ ...emptyEntry(), stress: 0 }).success).toBe(true);
    expect(entrySchema.safeParse({ ...emptyEntry(), fatigue: 1.5 }).success).toBe(false);
    expect(entrySchema.safeParse({ ...emptyEntry(), trainingStatus: 'trained' }).success).toBe(
      false,
    );
  });
  it('requires known effort for every session before calculating a daily load', () => {
    const entry = stored();
    entry.trainingStatus = 'trained';
    const session = {
      id: crypto.randomUUID(),
      type: 'running' as const,
      title: '',
      durationMinutes: 45,
      distanceKm: 7,
      effort: 4,
      pain: 0,
      averageHeartRate: null,
      sets: [],
      notes: '',
    };
    entry.workouts = [session];
    expect(summarize(entry).trainingLoad).toBe(180);
    entry.workouts.push({ ...session, id: crypto.randomUUID(), effort: null });
    expect(summarize(entry).trainingLoad).toBeNull();
  });
  it('rejects zero illness with symptoms and duplicate symptoms', () => {
    const entry = emptyEntry();
    entry.illnessSeverity = 0;
    entry.symptoms = [{ name: 'cough', severity: 2 }];
    expect(entrySchema.safeParse(entry).success).toBe(false);
    entry.illnessSeverity = 2;
    expect(entrySchema.safeParse(entry).success).toBe(true);
    entry.symptoms.push({ name: 'cough', severity: 1 });
    expect(entrySchema.safeParse(entry).success).toBe(false);
  });
  it('keeps date arithmetic independent of daylight-saving clock changes', () => {
    expect(shiftDate('2026-03-28', 1)).toBe('2026-03-29');
    expect(shiftDate('2026-10-25', -1)).toBe('2026-10-24');
  });
});
