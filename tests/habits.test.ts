import { fitMultivariable } from '../shared/multivariable';
import { describe, expect, it } from 'vitest';
import { habitRecordSchema, habitsSchema, habitValue } from '../shared/habits';
import { emptyEntry, shiftDate, summarize, type StoredEntry } from '../shared/schema';
import { featureCatalog } from '../shared/features';
import { csvCell, exportGroups, flatten, selectFields } from '../shared/export';
import { mergeImported, parseImport } from '../shared/import';

import { customHabit } from './fixtures/habits';

const entry: StoredEntry = {
  ...emptyEntry('2026-01-01'),
  habits: [customHabit],
  revision: 1,
  createdAt: '',
  updatedAt: '',
};
describe('Structured activity observations', () => {
  it('preserves unknown, explicit zero, original names and notes while rejecting inconsistent records', () => {
    expect(habitRecordSchema.parse(customHabit)).toEqual(customHabit);
    expect(habitsSchema.parse(undefined)).toEqual([]);
    expect(habitValue(undefined, 'count')).toBeNull();
    expect(habitValue({ ...customHabit, count: null }, 'count')).toBeNull();
    expect(
      habitValue({ ...customHabit, count: 0, times: [], durationMinutes: null }, 'duration'),
    ).toBeNull();
    expect(habitValue({ ...customHabit, count: 0, times: [], durationMinutes: 0 }, 'count')).toBe(
      0,
    );
    for (const patch of [
      { count: -1 },
      { count: 1.5 },
      { count: 1 },
      { count: 0, times: [] },
      { name: null },
      { key: 'custom:not-an-id' },
      { key: 'preset:reading_before_bed' },
      { times: ['24:00'] },
      { times: ['1:00'] },
      { durationMinutes: 1441 },
    ])
      expect(habitRecordSchema.safeParse({ ...customHabit, ...patch }).success).toBe(false);
    expect(habitsSchema.safeParse([customHabit, customHabit]).success).toBe(false);
    expect(habitRecordSchema.safeParse({ ...customHabit, times: ['12:00', '12:00'] }).success).toBe(
      true,
    );
  });
  it('uses the mean circular components only for completely timed events, including midnight wraparound', () => {
    expect(habitValue(customHabit, 'timeSin')).toBeCloseTo(0, 12);
    expect(habitValue(customHabit, 'timeCos')).toBeCloseTo(Math.cos(Math.PI / 72), 12);
    expect(habitValue({ ...customHabit, times: ['06:00', '18:00'] }, 'timeCos')).toBeCloseTo(0, 12);
    expect(habitValue({ ...customHabit, times: ['06:00', '18:00'] }, 'timeSin')).toBeCloseTo(0, 12);
    for (const record of [
      undefined,
      { ...customHabit, count: null },
      { ...customHabit, times: ['23:50'] },
      { ...customHabit, count: 0, times: [] },
    ])
      expect(habitValue(record, 'timeSin')).toBeNull();
  });
  it('keeps a stable feature identity across custom name changes, strips notes and never fills missing days with zero', () => {
    const old = summarize(entry);
    const renamed = summarize({
      ...entry,
      date: '2026-01-02',
      habits: [
        { ...customHabit, name: 'New original name', count: 0, times: [], durationMinutes: 0 },
      ],
    });
    const absent = summarize({ ...entry, date: '2026-01-03', habits: [] });
    const feature = featureCatalog([renamed, old, absent]).find(
      (f) => f.id === `habit:${customHabit.key}:count`,
    )!;
    expect(feature.label).toContain('New original name');
    expect([feature.get(old), feature.get(renamed), feature.get(absent)]).toEqual([2, 0, null]);
    expect(JSON.stringify(old)).not.toContain(customHabit.notes);
    expect(old.habits[0].name).toBe(customHabit.name);
  });
  it('fits a custom count as a numeric Bayesian input with chronological validation', () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      summarize({
        ...entry,
        date: shiftDate(entry.date, i),
        wellbeing: 1 + ((i * 7) % 9),
        habits: [{ ...customHabit, count: 1 + ((i * 7) % 9), times: [] }],
      }),
    );
    const id = `habit:${customHabit.key}:count`;
    const result = fitMultivariable(rows, {
      target: 'wellbeing',
      features: [id],
      horizon: 0,
      window: 1,
      history: false,
      time: false,
      prior: 'regular',
    });
    expect(result.ready).toBe(true);
    if (!result.ready) throw new Error('Expected an estimable model');
    expect(result.coefficients[0].id).toBe(id);
    expect(result.coefficients[0].typicalChange).toBeGreaterThan(0);
    expect(result.validation).not.toBeNull();
    expect(result.curve).toHaveLength(60);
  });
  it('round-trips full and notes-excluded observations in JSON, NDJSON and CSV; old files preserve existing activities', () => {
    for (const includeNotes of [true, false]) {
      const exported = selectFields(entry, includeNotes ? [...exportGroups] : ['habits']);
      expect(JSON.stringify(exported).includes('Oryginalny')).toBe(includeNotes);
      const flat = flatten(exported),
        keys = Object.keys(flat);
      const csv =
        keys.map(csvCell).join(',') + '\n' + keys.map((key) => csvCell(flat[key])).join(',');
      for (const [format, text] of [
        ['json', JSON.stringify({ entries: [exported] })],
        ['ndjson', JSON.stringify(exported)],
        ['csv', csv],
      ] as const) {
        const imported = parseImport(text, format)[0];
        expect(mergeImported(imported, entry).habits).toEqual(entry.habits);
        expect(mergeImported(imported).habits).toEqual([
          { ...customHabit, notes: includeNotes ? customHabit.notes : '' },
        ]);
      }
    }
    expect(selectFields(entry, ['habits', 'notes'], ['habits'])).not.toHaveProperty(
      'habits.0.notes',
    );
    expect(selectFields(entry, ['habits', 'notes'], ['habits', 'habitNotes'])).toHaveProperty(
      'habits.0.notes',
      customHabit.notes,
    );
    const partial = parseImport(JSON.stringify([{ date: entry.date, wellbeing: 6 }]), 'json')[0];
    expect(mergeImported(partial, entry).habits).toEqual(entry.habits);
    expect(
      mergeImported(
        parseImport(JSON.stringify([{ date: entry.date, habits: [] }]), 'json')[0],
        entry,
      ).habits,
    ).toEqual([]);
    expect(() =>
      parseImport(
        JSON.stringify([{ date: entry.date, habits: [customHabit, customHabit] }]),
        'json',
      ),
    ).toThrow();
  });
});
