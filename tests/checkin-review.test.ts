import { describe, expect, it } from 'vitest';
import { reviewCheckIn } from '../shared/checkin-review';
import { emptyEntry, shiftDate, summarize, type Entry } from '../shared/schema';
const date = '2026-10-15';
const summary = (entry: Entry) =>
  summarize({ ...entry, revision: 1, createdAt: '', updatedAt: '' });
const history = (n = 60) =>
  Array.from({ length: n }, (_, i) => {
    const stress = 1 + ((i * 7) % 9);
    return summary({
      ...emptyEntry(shiftDate(date, i - n)),
      stress,
      sleep: { ...emptyEntry(date).sleep, durationMinutes: (10 - stress * 0.6) * 60 },
    });
  });
const current = () => ({
  ...emptyEntry(date),
  stress: 8,
  sleep: { ...emptyEntry(date).sleep, durationMinutes: 9 * 60 },
});
describe('Check-in historical review', () => {
  it('flags a contradictory yet individually ordinary stress/sleep pair and never mutates the observation', () => {
    const entry = current(),
      rows = history(),
      before = JSON.stringify([entry, rows]);
    const result = reviewCheckIn(entry, rows);
    const warning = result.warnings.find((w) => w.kind === 'relationship' && w.lag === 0)!;
    expect(warning).toMatchObject({ n: 60, value: 9, predictorValue: 8 });
    expect(warning.correlation).toBeCloseTo(-1, 12);
    expect((warning.lower + warning.upper) / 2).toBeCloseTo(5.2, 12);
    // Independent Simpson integration of the Student-t density (df=58), then bisection at 0.9975.
    const half = 2.918394453620957 * 0.375 * Math.sqrt(1.0385113268608415);
    expect(warning.upper - 5.2).toBeCloseTo(half, 6);
    expect(5.2 - warning.lower).toBeCloseTo(half, 6);
    expect(warning.upper).toBeLessThan(9);
    expect(result.warnings.filter((w) => w.kind === 'value')).toEqual([]);
    expect(JSON.stringify([entry, rows])).toBe(before);
    entry.sleep.durationMinutes = 5.2 * 60;
    expect(
      reviewCheckIn(entry, rows).warnings.filter((w) => w.kind === 'relationship' && w.lag === 0),
    ).toEqual([]);
  });
  it('requires 30 earlier observations within 90 actual calendar days, excludes current/future dates and ignores missing data', () => {
    expect(reviewCheckIn(current(), history(29)).warnings).toEqual([]);
    const rows = history();
    const valid = reviewCheckIn(current(), rows);
    expect(
      reviewCheckIn(current(), [
        ...rows,
        summary(current()),
        summary({ ...current(), date: shiftDate(date, 1) }),
      ]),
    ).toEqual(valid);
    expect(
      reviewCheckIn(
        current(),
        rows.map((r) => ({ ...r, date: shiftDate(r.date, -100) })),
      ).warnings,
    ).toEqual([]);
    expect(
      reviewCheckIn(
        current(),
        rows.map((r) => ({ ...r, stress: null })),
      ).warnings,
    ).toEqual([]);
    expect(reviewCheckIn(emptyEntry(date), rows).warnings).toEqual([]);
  });
  it('matches the modified-Z threshold, retains a scale floor for constant histories and does not interpret missing habits as zero', () => {
    const rows = Array.from({ length: 31 }, (_, i) =>
      summary({ ...emptyEntry(shiftDate(date, i - 31)), stress: (i % 3) + 1 }),
    );
    const w = reviewCheckIn({ ...emptyEntry(date), stress: 10 }, rows).warnings.find(
      (w) => w.kind === 'value',
    )!;
    expect(w.lower).toBeCloseTo(2 - 3.5 / 0.67448975, 10);
    expect(w.upper).toBeCloseTo(2 + 3.5 / 0.67448975, 10);
    const constant = rows.map((r) => ({ ...r, stress: 5 }));
    expect(reviewCheckIn({ ...emptyEntry(date), stress: 6 }, constant).warnings).toEqual([]);
    expect(
      reviewCheckIn({ ...emptyEntry(date), stress: 10 }, constant).warnings.some(
        (w) => w.kind === 'value',
      ),
    ).toBe(true);
    const habit = {
      key: 'preset:nail_biting',
      name: null,
      count: 50,
      times: [],
      durationMinutes: null,
      notes: '',
    };
    expect(reviewCheckIn({ ...emptyEntry(date), habits: [habit] }, rows).warnings).toEqual([]);
    const observed = rows.map((r) => ({ ...r, habits: [{ ...habit, count: 1 }] }));
    expect(reviewCheckIn({ ...emptyEntry(date), habits: [habit] }, observed).warnings).toHaveLength(
      1,
    );
  });
  it('compares HRV only within known matching methods and consistent sources', () => {
    const rows = history().map((r) => ({
      ...r,
      stress: null,
      physiology: {
        ...r.physiology,
        hrv: 50,
        hrvMethod: 'rmssd' as const,
        source: 'garmin' as const,
      },
    }));
    const entry = {
      ...emptyEntry(date),
      physiology: {
        ...emptyEntry(date).physiology,
        hrv: 130,
        hrvMethod: 'sdnn' as const,
        source: 'garmin' as const,
      },
    };
    expect(reviewCheckIn(entry, rows).warnings).toEqual([]);
    expect(
      reviewCheckIn(
        { ...entry, physiology: { ...entry.physiology, hrvMethod: 'rmssd', source: 'manual' } },
        rows,
      ).warnings,
    ).toEqual([]);
    expect(
      reviewCheckIn({ ...entry, physiology: { ...entry.physiology, hrvMethod: 'rmssd' } }, rows)
        .warnings,
    ).toHaveLength(1);
  });
  it('does not warn from extrapolation, a shared linear trend or unstable association', () => {
    expect(
      reviewCheckIn({ ...current(), stress: 10 }, history()).warnings.filter(
        (w) => w.kind === 'relationship',
      ),
    ).toEqual([]);
    const trend = history().map((r, i) => ({
      ...r,
      stress: 1 + i / 10,
      sleep: { ...r.sleep, durationMinutes: 600 - i * 3 },
    }));
    expect(
      reviewCheckIn(current(), trend).warnings.filter((w) => w.kind === 'relationship'),
    ).toEqual([]);
    const unstable = history().map((r, i) =>
      i < 30 ? r : { ...r, sleep: { ...r.sleep, durationMinutes: (3 + r.stress! * 0.6) * 60 } },
    );
    expect(
      reviewCheckIn(current(), unstable).warnings.filter((w) => w.kind === 'relationship'),
    ).toEqual([]);
  });
  it('aligns lagged relationships to preceding calendar dates and does not bridge gaps', () => {
    const rows = history();
    const lagged = rows.map((r, i) => ({
      ...r,
      sleep: { ...r.sleep, durationMinutes: i ? (10 - rows[i - 1].stress! * 0.6) * 60 : null },
    }));
    const entry = {
      ...current(),
      stress: null,
      sleep: { ...current().sleep, durationMinutes: rows.at(-1)!.stress! > 5 ? 10 * 60 : 3 * 60 },
    };
    expect(
      reviewCheckIn(entry, lagged).warnings.some((w) => w.kind === 'relationship' && w.lag === 1),
    ).toBe(true);
    expect(
      reviewCheckIn(entry, lagged.slice(0, -1)).warnings.some((w) => w.kind === 'relationship'),
    ).toBe(false);
    const gaps = lagged.map((r, i) => ({ ...r, date: shiftDate(date, -2 * (60 - i)) }));
    expect(reviewCheckIn(entry, gaps).warnings.some((w) => w.kind === 'relationship')).toBe(false);
  });
});
