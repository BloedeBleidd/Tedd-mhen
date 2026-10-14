import { describe, it, expect } from 'vitest';
import { parseCsv, parseImport, mergeImported, IMPORT_MAX_BYTES } from '../shared/import';
import { emptyEntry, entrySchema, shiftDate } from '../shared/schema';
import { csvCell, exportGroups, flatten, selectFields } from '../shared/export';
const entry = {
  ...emptyEntry('2026-01-01'),
  wellbeing: 8,
  notes: 'Quoted "note"\nSecond line',
  labels: ['travel'],
  revision: 9,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
describe('Journal import parsing and selective merge', () => {
  it('enforces bounded file sizes and row counts without dropping observations', () => {
    const days = Array.from({ length: 500 }, (_, i) => ({
      date: shiftDate('2020-01-01', i),
      wellbeing: 5,
    }));
    expect(parseImport(JSON.stringify(days), 'json')).toHaveLength(500);
    expect(() => parseImport(JSON.stringify([...days, { date: '2025-01-01' }]), 'json')).toThrow(
      '500',
    );
    expect(() => parseImport(' '.repeat(IMPORT_MAX_BYTES + 1), 'json')).toThrow('20 MiB');
  });
  it('round-trips full JSON, NDJSON and CSV exports without source revisions or ownership', () => {
    const exported = selectFields(entry, [...exportGroups]);
    const flat = flatten(exported),
      keys = Object.keys(flat),
      csv = keys.map(csvCell).join(',') + '\n' + keys.map((k) => csvCell(flat[k])).join(',');
    for (const [format, text] of [
      ['json', JSON.stringify({ entries: [exported] })],
      ['ndjson', JSON.stringify({ _meta: { schemaVersion: 1 } }) + '\n' + JSON.stringify(exported)],
      ['csv', csv],
    ] as const) {
      const rows = parseImport(text, format),
        restored = mergeImported(rows[0]);
      expect(restored).toEqual(
        entrySchema.parse(
          Object.fromEntries(
            Object.entries(entry).filter(
              ([key]) => !['revision', 'createdAt', 'updatedAt'].includes(key),
            ),
          ),
        ),
      );
      expect(restored).not.toHaveProperty('revision');
    }
  });
  it('preserves omitted fields and exact nulls when merging a partial export', () => {
    const rows = parseImport(
      JSON.stringify({
        entries: [{ date: entry.date, wellbeing: 4, sleep: { quality: 8 }, labels: null }],
      }),
      'json',
    );
    const restored = mergeImported(rows[0], entry);
    expect(restored.notes).toBe(entry.notes);
    expect(restored.sleep.quality).toBe(8);
    expect(restored.sleep.durationMinutes).toBeNull();
    expect(restored.labels).toBeNull();
    expect(restored.wellbeing).toBe(4);
  });
  it('parses quoted commas, escaped quotes, multiline cells and BOM, rejecting malformed input', () => {
    expect(parseCsv('a,b\r\n"one, two","a""b\nnext"\r\n')).toEqual([
      ['a', 'b'],
      ['one, two', 'a"b\nnext'],
    ]);
    expect(parseImport('\uFEFFdate,wellbeing\n2026-01-01,7', 'csv')[0].fields.wellbeing).toBe(7);
    expect(() => parseCsv('"open')).toThrow('Unclosed');
    expect(() => parseCsv('"a"bad')).toThrow();
    expect(() => parseImport('date,date\n2026-01-01,2026-01-02', 'csv')).toThrow('Duplicate');
  });
  it('rejects unknown fields, schema versions, duplicate days, invalid ratings and prototype keys', () => {
    for (const row of [
      { ...entry, schemaVersion: 2 },
      { ...entry, wellbeing: 11 },
      { ...entry, owner_id: 'someone' },
      { ...entry, labels: ['travel', 'travel'] },
      { ...entry, sleep: JSON.parse('{"__proto__":{"quality":7}}') },
    ])
      expect(() => parseImport(JSON.stringify({ entries: [row] }), 'json')).toThrow();
    expect(() => parseImport(JSON.stringify([entry, entry]), 'json')).toThrow('Duplicate date');
    expect(() => parseImport('date,schemaVersion\n2026-01-01,2', 'csv')).toThrow('schema version');
    expect(() => parseImport('date,revision.extra\n2026-01-01,2', 'csv')).toThrow(
      'Unsupported CSV column',
    );
    expect(() =>
      parseImport(JSON.stringify({ schemaVersion: 2, entries: [entry] }), 'json'),
    ).toThrow('schema version');
    expect(() =>
      parseImport(
        JSON.stringify({ _meta: { schemaVersion: 2 } }) + '\n' + JSON.stringify(entry),
        'ndjson',
      ),
    ).toThrow('schema version');
    expect(() =>
      parseImport(JSON.stringify(entry) + '\n' + JSON.stringify({ _meta: {} }), 'ndjson'),
    ).toThrow('first line');
  });
  it('preserves excluded workout notes by ID, validates session totals and leaves unknown training unknown', () => {
    const workout = {
      id: crypto.randomUUID(),
      type: 'running' as const,
      title: 'Run',
      durationMinutes: 30,
      distanceKm: 5,
      effort: 5,
      pain: 0,
      averageHeartRate: 140,
      sets: [],
      notes: 'Keep this note',
    };
    const existing = { ...entry, trainingStatus: 'trained' as const, workouts: [workout] };
    const { notes: _note, ...withoutNotes } = workout;
    const row = parseImport(
      JSON.stringify([{ date: entry.date, workouts: [{ ...withoutNotes, durationMinutes: 45 }] }]),
      'json',
    )[0];
    expect(mergeImported(row, existing).workouts[0].notes).toBe('Keep this note');
    expect(mergeImported(row).workouts[0].notes).toBe('');
    expect(() =>
      parseImport(
        JSON.stringify([
          {
            date: entry.date,
            workouts: [
              { ...workout, durationMinutes: 1440 },
              { ...workout, id: crypto.randomUUID() },
            ],
          },
        ]),
        'json',
      ),
    ).toThrow('24 hours');
    expect(
      mergeImported(parseImport(JSON.stringify([{ date: entry.date, wellbeing: 6 }]), 'json')[0])
        .trainingStatus,
    ).toBe('unrecorded');
  });
});
