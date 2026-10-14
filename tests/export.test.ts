import { describe, expect, it } from 'vitest';
import { csvCell, flatten, markdownEntry, selectFields } from '../shared/export';
import { emptyEntry, type StoredEntry } from '../shared/schema';
const entry: StoredEntry = {
  ...emptyEntry('2026-10-14'),
  revision: 1,
  createdAt: '2026-10-14T17:00Z',
  updatedAt: '2026-10-14T17:00Z',
  notes: 'private narrative',
};
describe('Selective export', () => {
  it('excludes narratives, including nested session notes, unless explicitly selected', () => {
    const withWorkout = {
      ...entry,
      workouts: [
        {
          id: crypto.randomUUID(),
          type: 'running' as const,
          title: '',
          durationMinutes: 30,
          distanceKm: null,
          effort: 4,
          pain: 0,
          averageHeartRate: null,
          sets: [],
          notes: 'private session narrative',
        },
      ],
    };
    const data = selectFields(withWorkout, ['ratings', 'workouts']);
    expect(JSON.stringify(data)).not.toContain('private');
    expect(data).not.toHaveProperty('sleep');
    expect(selectFields(withWorkout, ['notes', 'workouts'])).toHaveProperty(
      'notes',
      'private narrative',
    );
  });
  it('exports individual fields without unrelated physiology values', () => {
    const data = selectFields(entry, ['physiology', 'ratings'], ['physiology.hrv', 'wellbeing']);
    expect(data).toHaveProperty('physiology.hrv', null);
    expect(data).not.toHaveProperty('physiology.weightKg');
    expect(data).not.toHaveProperty('fatigue');
    expect(data).toHaveProperty('date', entry.date);
  });
  it('preserves null versus zero and serializes repeated structures', () => {
    expect(flatten({ a: null, b: 0, sleep: { score: 0 }, symptoms: [] })).toEqual({
      a: null,
      b: 0,
      'sleep.score': 0,
      symptoms: '[]',
    });
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('"0"');
  });
  it('quotes commas, newlines, quotes, and mitigates spreadsheet formula injection', () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(' =HYPERLINK("evil")')).toMatch(/^"'/);
    expect(csvCell('-42')).toBe('"\'-42"');
    expect(csvCell(-42)).toBe('"-42"');
  });
  it('keeps user text inside an adequately long Markdown fence', () => {
    const result = markdownEntry({ date: '2026-10-14', notes: '```\nhello\n````' });
    expect(result).toContain('`````json');
    expect(result.endsWith('`````\n')).toBe(true);
  });
});
