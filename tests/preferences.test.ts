import { describe, expect, it } from 'vitest';
import {
  personalizedEntry,
  initialRatingChoices,
  checkInFields,
  emptyPreferences,
  fieldRecorded,
  mergePreference,
  preferenceChangeSchema,
  preferenceKey,
  preferencesFromRows,
  rankChoices,
  routineHabits,
  type PreferenceChange,
} from '../shared/preferences';
import { activityGroups, supportsDistance, supportsSets, workoutTypes } from '../shared/activities';
import { emptyEntry } from '../shared/schema';
import { customHabit } from './fixtures/habits';
import { DemoWorkspace } from '../src/lib/demo-workspace';
import { DEMO_DATASET } from '../shared/demo';

const row = (change: PreferenceChange, time = 1, uses = 1) => ({
  key: preferenceKey(change),
  payload: JSON.stringify(change),
  last_used: time,
  uses,
});
describe('Personal check-in preferences', () => {
  it('merges independent fields, preserves explicit zeros and never changes entries', () => {
    const e = emptyEntry('2026-01-01');
    expect(
      Object.values(checkInFields)
        .flat()
        .every((field) => !fieldRecorded(e, field)),
    ).toBe(true);
    e.stress = 0;
    e.sleep.awakenings = 0;
    e.labels = [];
    e.trainingStatus = 'rest';
    for (const field of ['stress', 'sleep.awakenings', 'labels', 'trainingStatus'] as const)
      expect(fieldRecorded(e, field)).toBe(true);
    const before = structuredClone(e);
    const preferences = preferencesFromRows([
      row({ kind: 'field', id: 'stress', visible: false }),
      row({ kind: 'field', id: 'sleep.quality', visible: false }),
      row({ kind: 'field', id: 'stress', visible: true }),
    ]);
    expect(preferences.fields).toEqual({ stress: true, 'sleep.quality': false });
    expect(e).toEqual(before);
  });
  it('ranks recency first, frequency on equal timestamps, with deterministic unused order', () => {
    const prefs = preferencesFromRows([
      row({ kind: 'choice', list: 'activity', value: 'running' }, 10, 50),
      row({ kind: 'choice', list: 'activity', value: 'swimming' }, 20, 1),
      row({ kind: 'choice', list: 'activity', value: 'strength' }, 20, 2),
      row({ kind: 'choice', list: 'label', value: 'cycling' }, 999, 999),
    ]);
    const choices = ['running', 'cycling', 'swimming', 'strength', 'yoga'];
    expect(rankChoices(choices, 'activity', prefs, (s) => s)).toEqual([
      'strength',
      'swimming',
      'running',
      'cycling',
      'yoga',
    ]);
    expect(choices[0]).toBe('running');
    expect(rankChoices(choices, 'source', prefs, (s) => s)).toEqual(choices);
    expect(
      mergePreference(prefs, row({ kind: 'choice', list: 'activity', value: 'running' }, 30, 51))
        .usage,
    ).toHaveLength(4);
  });
  it('constructs blank recurring habits, excludes archived/missing definitions and preserves names', () => {
    let prefs = preferencesFromRows([
      row({ kind: 'habit', key: customHabit.key, enabled: true }),
      row({ kind: 'habit', key: 'preset:reading_before_bed', enabled: true }),
    ]);
    const definitions = [{ key: customHabit.key, name: customHabit.name!, archived: false }];
    expect(routineHabits(prefs, definitions)).toEqual([
      {
        key: customHabit.key,
        name: customHabit.name,
        count: null,
        times: [],
        durationMinutes: null,
        notes: '',
      },
      {
        key: 'preset:reading_before_bed',
        name: null,
        count: null,
        times: [],
        durationMinutes: null,
        notes: '',
      },
    ]);
    expect(routineHabits(prefs, [{ ...definitions[0], archived: true }])).toHaveLength(1);
    expect(routineHabits(prefs, [])).toHaveLength(1);
    prefs = mergePreference(
      prefs,
      row({ kind: 'habit', key: 'preset:reading_before_bed', enabled: false }),
    );
    expect(routineHabits(prefs, [])).toEqual([]);
  });
  it('rejects unknown fields, injected owners, invalid identifiers and translated canonical values', () => {
    for (const change of [
      { kind: 'field', id: 'owner_id', visible: false },
      { kind: 'field', id: 'wellbeing', visible: false, owner_id: 'another' },
      { kind: 'habit', key: 'custom:no-uuid', enabled: true },
      { kind: 'choice', list: 'activity', value: 'Pływanie' },
      { kind: 'choice', list: 'metric', value: '__proto__' },
      { kind: 'choice', list: 'feature', value: 'habit:custom:bad:count' },
      { kind: 'choice', list: 'label', value: 'x'.repeat(41) },
    ])
      expect(preferenceChangeSchema.safeParse(change).success).toBe(false);
    for (const change of [
      { kind: 'choice', list: 'activity', value: 'swimming' },
      { kind: 'choice', list: 'feature', value: `habit:${customHabit.key}:count` },
      { kind: 'choice', list: 'label', value: 'Żółć {{count}} <original>' },
    ])
      expect(preferenceChangeSchema.safeParse(change).success).toBe(true);
  });
  it('uses finite, stable sport capabilities without modifying observation data', () => {
    expect(workoutTypes).toHaveLength(150);
    for (const activity of workoutTypes) {
      expect(typeof supportsDistance(activity)).toBe('boolean');
      expect(typeof supportsSets(activity)).toBe('boolean');
      if (activityGroups[activity] === 'combat' || activityGroups[activity] === 'mind_body')
        expect(supportsDistance(activity)).toBe(false);
    }
    for (const activity of ['running', 'cycling', 'swimming', 'rowing', 'hiking'] as const)
      expect(supportsDistance(activity)).toBe(true);
    for (const activity of ['strength', 'yoga', 'powerlifting', 'bouldering', 'archery'] as const)
      expect(supportsDistance(activity)).toBe(false);
    expect(supportsSets('powerlifting')).toBe(true);
    expect(supportsSets('swimming')).toBe(false);
  });
  it('keeps demo preferences isolated from a second workspace and all measurements', () => {
    const entry = {
      ...emptyEntry('2026-01-01'),
      revision: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const snapshot = {
      id: DEMO_DATASET,
      title: 'Synthetic example',
      anchorDate: entry.date,
      recordCount: 1,
      entries: [entry],
    };
    const a = new DemoWorkspace(snapshot, entry.date),
      b = new DemoWorkspace(snapshot, entry.date);
    const change: PreferenceChange = { kind: 'field', id: 'wellbeing', visible: false };
    a.request('/api/preferences', { method: 'PATCH', body: JSON.stringify(change) });
    expect(a.request('/api/preferences')).toEqual({
      ...emptyPreferences(),
      fields: { wellbeing: false },
    });
    expect(b.request('/api/preferences')).toEqual(emptyPreferences());
    expect(a.snapshot()).toEqual([entry]);
    expect(() =>
      a.request('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify(change),
        headers: { 'X-Teddmhen-Expected-User': 'real-owner' },
      }),
    ).toThrow();
  });
});

it('new days remember measurement method but never copy observations or training status', () => {
  const prefs = preferencesFromRows([
    row({ kind: 'choice', list: 'source', value: 'polar' }, 10),
    row({ kind: 'choice', list: 'hrvMethod', value: 'rmssd' }, 20),
    row({ kind: 'choice', list: 'trainingStatus', value: 'rest' }, 30),
  ]);
  const entry = personalizedEntry('2026-01-02', prefs, []);
  expect(entry.physiology).toEqual({
    ...emptyEntry(entry.date).physiology,
    source: 'polar',
    hrvMethod: 'rmssd',
  });
  expect(entry.trainingStatus).toBe('unrecorded');
  expect(entry.wellbeing).toBeNull();
  expect(entry.sleep).toEqual(emptyEntry(entry.date).sleep);
});

it('unselected first-use ratings hide on later days while explicit field choices remain authoritative', () => {
  const entry = emptyEntry('2026-01-01');
  entry.stress = 0;
  const preferences = emptyPreferences();
  preferences.fields.wellbeing = true;
  preferences.fields['sleep.quality'] = false;
  const changes = initialRatingChoices(entry, preferences);
  expect(changes).toContainEqual({ kind: 'field', id: 'energy', visible: false });
  expect(changes).toContainEqual({ kind: 'field', id: 'stress', visible: true });
  expect(
    changes.some(
      (change) => change.kind === 'field' && ['wellbeing', 'sleep.quality'].includes(change.id),
    ),
  ).toBe(false);
});
