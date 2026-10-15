import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeDemoFixture, demoFixture, demoMigration } from '../scripts/demo-fixture.mjs';
import { DEMO_DATASET, DEMO_OWNER } from '../shared/demo';
import { entrySchema, summarize, emptyEntry, dayNumber } from '../shared/schema';
import { DemoWorkspace } from '../src/lib/demo-workspace';
import { fitMultivariable } from '../shared/multivariable';
import { adapter } from './database';
import { adminOverview } from '../worker/admin';
const snapshot = () => ({
  id: demoFixture.id,
  title: demoFixture.title,
  anchorDate: demoFixture.anchorDate,
  recordCount: 236,
  entries: makeDemoFixture().map((e) => ({
    ...e,
    revision: 1,
    createdAt: `${e.date}T18:00:00.000Z`,
    updatedAt: `${e.date}T18:00:00.000Z`,
  })),
});
const workspace = () => new DemoWorkspace(snapshot(), '2028-03-01');
const put = (space, entry, revision = 0) =>
  space.request(`/api/entries/${entry.date}`, {
    method: 'PUT',
    body: JSON.stringify({ entry, revision }),
  });

describe('Shared synthetic journal', () => {
  it('is deterministic, schema-valid and covers missing observations, labels, symptoms and several sports', () => {
    const rows = makeDemoFixture();
    expect(rows).toEqual(makeDemoFixture());
    expect(rows).toHaveLength(236);
    expect(rows.at(-1).date).toBe(demoFixture.anchorDate);
    expect(dayNumber(rows.at(-1).date) - dayNumber(rows[0].date)).toBe(239);
    rows.forEach((e) => expect(entrySchema.safeParse(e).success, e.date).toBe(true));
    expect(new Set(rows.map((e) => e.trainingStatus))).toEqual(
      new Set(['rest', 'trained', 'unrecorded']),
    );
    expect(new Set(rows.flatMap((e) => e.workouts.map((w) => w.type))).size).toBe(6);
    expect(rows.some((e) => e.workouts.length > 1)).toBe(true);
    expect(rows.some((e) => e.workouts.some((w) => w.sets.length))).toBe(true);
    expect(rows.some((e) => e.labels === null)).toBe(true);
    expect(rows.some((e) => e.labels?.length === 0)).toBe(true);
    expect(rows.some((e) => e.physiology.hrv === null)).toBe(true);
    expect(rows.some((e) => e.sleep.durationMinutes === null)).toBe(true);
    expect(rows.filter((e) => e.illnessSeverity > 0)).toHaveLength(16);
    for (const e of rows.filter((e) => e.sleep.durationMinutes !== null)) {
      const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
      const inBed = (minutes(e.sleep.wakeTime) - minutes(e.sleep.bedtime) + 1440) % 1440;
      expect(inBed).toBe(e.sleep.durationMinutes + e.sleep.latencyMinutes + e.sleep.awakenings * 8);
    }
  });
  it('supports the default multivariable view and labels with real uncertainty and chronological validation', () => {
    const rows = workspace().snapshot().map(summarize).slice(-180);
    for (const horizon of [0, 1, 7]) {
      const result = fitMultivariable(rows, {
        target: 'wellbeing',
        features: ['sleepHours', 'trainingLoad', 'stress', 'trained', 'label:late meal'],
        horizon,
        window: 1,
        history: true,
        time: true,
        prior: 'regular',
      });
      expect(result.ready).toBe(true);
      expect(result.validation).not.toBeNull();
      expect(result.validation.lastTrainingOutcome < result.validation.firstValidationOrigin).toBe(
        true,
      );
      expect(
        result.curve.every(
          (point) => Number.isFinite(point.mean) && point.predictive[1] > point.credible[1],
        ),
      ).toBe(true);
      expect(result.coefficients.some((c) => c.id === 'label:late meal')).toBe(true);
    }
  });
  it('seeds the exact reproducible migration, rejects baseline writes and credentials, and keeps admin totals separate', async () => {
    expect(demoFixture.id).toBe(DEMO_DATASET);
    expect(demoFixture.owner).toBe(DEMO_OWNER);
    expect(readFileSync('migrations/0004_demo_journal.sql', 'utf8')).toBe(demoMigration());
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('PRAGMA foreign_keys=ON');
      readdirSync('migrations')
        .sort()
        .forEach((name) => db.exec(readFileSync(`migrations/${name}`, 'utf8')));
      const rows = db
        .prepare('SELECT data FROM entries WHERE owner_id = ? ORDER BY date')
        .all(DEMO_OWNER);
      expect(rows.map((row) => JSON.parse(row.data))).toEqual(makeDemoFixture());
      expect(db.prepare('SELECT COUNT(*) AS n FROM auth_accounts').get().n).toBe(0);
      for (const sql of [
        `DELETE FROM entries WHERE owner_id='${DEMO_OWNER}'`,
        `UPDATE entries SET revision=2 WHERE owner_id='${DEMO_OWNER}'`,
        `UPDATE entries SET owner_id='personal' WHERE owner_id='${DEMO_OWNER}'`,
        `INSERT INTO entries SELECT owner_id,'2030-01-01',data,1,created_at,updated_at FROM entries LIMIT 1`,
      ])
        expect(() => db.exec(sql)).toThrow('Shared demo records are immutable');
      expect(() =>
        db
          .prepare(
            'INSERT INTO auth_accounts(user_id,email,password_hash,recovery_hash) VALUES(?,?,?,?)',
          )
          .run(DEMO_OWNER, 'demo@example.test', 'x', 'y'),
      ).toThrow('Demo owners cannot sign in');
      db.exec("INSERT INTO users(id,email) VALUES ('personal','private@example.test')");
      db.prepare('INSERT INTO entries(owner_id,date,data) VALUES(?,?,?)').run(
        'personal',
        '2026-01-01',
        JSON.stringify(emptyEntry('2026-01-01')),
      );
      expect(() =>
        db.exec(`UPDATE entries SET owner_id='${DEMO_OWNER}' WHERE owner_id='personal'`),
      ).toThrow('Shared demo records are immutable');
      db.exec(
        "INSERT INTO auth_accounts(user_id,email,password_hash,recovery_hash) VALUES('personal','private@example.test','x','y')",
      );
      expect(() =>
        db.exec(`UPDATE auth_accounts SET user_id='${DEMO_OWNER}' WHERE user_id='personal'`),
      ).toThrow('Demo owners cannot sign in');
      const stats = await adminOverview(adapter(db));
      expect(stats.journal).toMatchObject({ entries: 1, recordingAccounts: 1 });
      expect(stats.accounts).toMatchObject({ accounts: 1 });
      expect(stats.demo.entries).toBe(236);
      db.exec("DELETE FROM entries WHERE owner_id='personal'");
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(db.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
    } finally {
      db.close();
    }
  });
});

describe('Isolated browser demo workspace', () => {
  it('rebases dates and timestamps over leap days while retaining gaps, values and UUIDs', () => {
    const source = snapshot(),
      space = new DemoWorkspace(source, '2028-03-01'),
      rows = space.snapshot();
    expect(rows.at(-1).date).toBe('2028-03-01');
    expect(rows.at(-1).createdAt).toBe('2028-03-01T18:00:00.000Z');
    expect(rows.some((e) => e.date === '2028-02-29')).toBe(true);
    expect(rows.map((e, i) => dayNumber(e.date) - dayNumber(source.entries[i].date))).toEqual(
      Array(236).fill(dayNumber('2028-03-01') - dayNumber(demoFixture.anchorDate)),
    );
    expect(rows.map((e) => e.workouts)).toEqual(source.entries.map((e) => e.workouts));
    rows[0].wellbeing = 1;
    source.entries[1].notes = 'changed outside';
    expect(space.snapshot()[0].wellbeing).not.toBe(1);
    expect(space.snapshot()[1].notes).not.toBe('changed outside');
  });
  it('rejects incomplete, duplicate, invalid and unversioned snapshots', () => {
    const value = snapshot();
    expect(() => new DemoWorkspace({ ...value, entries: value.entries.slice(1) })).toThrow();
    expect(() => new DemoWorkspace({ ...value, id: 'unknown' })).toThrow();
    expect(
      () => new DemoWorkspace({ ...value, entries: [...value.entries.slice(1), value.entries[1]] }),
    ).toThrow();
    expect(() => new DemoWorkspace({ ...value, anchorDate: '2026-02-30' })).toThrow();
    expect(() => new DemoWorkspace(value, 'bad')).toThrow();
  });
  it('handles sequential imports, conflicts and deletes without mutating another workspace or source', () => {
    const a = workspace(),
      b = workspace();
    const first = { ...emptyEntry('2001-01-01'), wellbeing: 8, notes: 'local example' };
    const second = { ...emptyEntry('2001-01-02'), wellbeing: 7 };
    put(a, first);
    put(a, second);
    expect(a.request('/api/entries?from=2001-01-01&to=2001-01-02').total).toBe(2);
    expect(() => b.request('/api/entries/2001-01-01')).toThrow('No entry');
    expect(() => put(a, first)).toThrow('Entry changed');
    expect(put(a, { ...first, wellbeing: 9 }, 1).revision).toBe(2);
    const returned = a.request('/api/entries/2001-01-01');
    returned.wellbeing = 2;
    expect(a.request('/api/entries/2001-01-01').wellbeing).toBe(9);
    expect(() => a.request('/api/entries/2001-01-01?revision=1', { method: 'DELETE' })).toThrow(
      'Entry changed',
    );
    a.request('/api/entries/2001-01-01?revision=2', { method: 'DELETE' });
    expect(() => a.request('/api/entries/2001-01-01')).toThrow('No entry');
    expect(() => put(a, { ...first, wellbeing: 99 })).toThrow('Check the demo entry');
    expect(() =>
      a.request('/api/entries/2001-01-03', {
        method: 'PUT',
        body: JSON.stringify({ entry: first, revision: 0 }),
      }),
    ).toThrow('date and URL');
    expect(b.snapshot()).toHaveLength(236);
  });
  it('paginates without duplicates, searches literally, filters illness and training, and strips notes from summaries', () => {
    const a = workspace();
    const page1 = a.request('/api/entries?limit=100');
    const page2 = a.request(`/api/entries?limit=100&cursor=${page1.nextCursor}`);
    const page3 = a.request(`/api/entries?limit=100&cursor=${page2.nextCursor}`);
    expect(
      new Set([...page1.entries, ...page2.entries, ...page3.entries].map((e) => e.date)).size,
    ).toBe(236);
    expect(page3.nextCursor).toBeNull();
    expect(page1.entries[0].notes).toBeUndefined();
    expect(page1.entries[0].workouts).toBeUndefined();
    expect(a.request('/api/entries?illness=yes').total).toBe(16);
    expect(a.request('/api/entries?illness=no').total).toBe(220);
    expect(
      a
        .request('/api/entries?type=strength')
        .entries.every((e) => e.workoutTypes.includes('strength')),
    ).toBe(true);
    expect(a.request('/api/entries?q=UNFAMILIAR').total).toBeGreaterThan(0);
    expect(a.request('/api/entries?q=%25').total).toBe(0);
    expect(a.request('/api/series').entries.length).toBeLessThan(90);
    expect(a.request('/api/series?all=true').entries).toHaveLength(236);
    const unknown = a
      .request('/api/series?all=true')
      .entries.find((e) => e.trainingStatus === 'unrecorded');
    expect(unknown.trainingLoad).toBeNull();
    expect(
      a.request('/api/series?all=true').entries.find((e) => e.trainingStatus === 'rest')
        .trainingLoad,
    ).toBe(0);
    for (const query of [
      'limit=0',
      'limit=101',
      'illness=bad',
      'type=bad',
      'from=2028-03-02&to=2028-03-01',
      'cursor=bad',
    ])
      expect(() => a.request(`/api/entries?${query}`)).toThrow();
    expect(() => a.request('/api/series?from=2000-01-01&to=2028-01-01')).toThrow();
  });
  it('denies account, administration and arbitrary endpoints and requires the displayed workspace identity', () => {
    const a = workspace();
    expect(a.request('/api/session')).toMatchObject({ id: 'demo:guest', admin: false });
    expect(() => a.request('/api/admin/overview')).toThrow('Administration is unavailable');
    expect(() => a.request('/api/auth/logout', { method: 'POST' })).toThrow(
      'Sign in or create an account',
    );
    expect(() => a.request('/api/export')).toThrow('Endpoint not found');
    expect(() => a.request('https://elsewhere.test/api/entries')).toThrow('Endpoint not found');
    expect(() => a.request('/api/entries', { method: 'POST' })).toThrow('Endpoint not found');
    expect(() =>
      a.request('/api/entries', { headers: { 'X-Teddmhen-Expected-User': 'viewer-a' } }),
    ).toThrow('workspace changed');
    expect(
      a.request('/api/entries', { headers: { 'X-Teddmhen-Expected-User': 'demo:guest' } }).total,
    ).toBe(236);
  });
});
