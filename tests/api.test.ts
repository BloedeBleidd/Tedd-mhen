import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index';
import { adapter } from './database';
import type { Env } from '../worker/auth';
import { customHabit } from './fixtures/habits';
import { emptyEntry } from '../shared/schema';
let actor = 'owner-a';
vi.mock('../worker/auth', () => ({
  authenticate: async () => ({ id: actor, email: `${actor}@example.test` }),
  isLocal: () => false,
  authenticateLegacy: async () => ({ id: 'legacy-owner', email: 'legacy@example.test' }),
}));
let env: Env, sqlite: DatabaseSync;
async function call(
  path: string,
  method = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
) {
  return worker.fetch(
    new Request(`https://journal.example${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Teddmhen-Request': '1',
        Origin: 'https://journal.example',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}
beforeEach(() => {
  sqlite?.close();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0002_accounts.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0003_administrators.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0005_habit_definitions.sql', 'utf8'));
  env = { DB: adapter(sqlite) } as Env;
  actor = 'owner-a';
});
describe('API ownership, concurrency, filtering, and streaming exports', () => {
  it('isolates custom libraries, validates writes and remembers imported categories only on successful revisions', async () => {
    const definition = { key: customHabit.key, name: customHabit.name, archived: false };
    expect(
      (await call('/api/habit-definitions', 'PUT', definition, { Origin: 'https://evil.test' }))
        .status,
    ).toBe(403);
    expect(
      (await call('/api/habit-definitions', 'PUT', { ...definition, owner_id: 'owner-b' })).status,
    ).toBe(400);
    expect(
      (
        await call('/api/habit-definitions', 'PUT', definition, {
          'X-Teddmhen-Expected-User': 'owner-b',
        })
      ).status,
    ).toBe(403);
    expect((await call('/api/habit-definitions', 'PUT', definition)).status).toBe(200);
    expect(await (await call('/api/habit-definitions')).json()).toEqual({
      definitions: [definition],
    });
    actor = 'owner-b';
    expect(await (await call('/api/habit-definitions')).json()).toEqual({ definitions: [] });
    const entry = { ...emptyEntry('2026-01-01'), habits: [customHabit] };
    expect((await call('/api/entries/2026-01-01', 'PUT', { entry, revision: 0 })).status).toBe(201);
    expect(await (await call('/api/habit-definitions')).json()).toEqual({
      definitions: [definition],
    });
    const other = {
      ...customHabit,
      key: 'custom:00000000-0000-4000-8000-000000000099',
      name: 'Stale',
    };
    expect(
      (
        await call('/api/entries/2026-01-01', 'PUT', {
          entry: { ...entry, habits: [other] },
          revision: 0,
        })
      ).status,
    ).toBe(409);
    expect(await (await call('/api/habit-definitions')).json()).toEqual({
      definitions: [definition],
    });
    expect(
      (await call('/api/habit-definitions', 'PUT', { ...definition, archived: true })).status,
    ).toBe(200);
    expect(await (await call('/api/entries/2026-01-01')).json()).toMatchObject({
      habits: [customHabit],
    });
    actor = 'owner-a';
    expect(await (await call('/api/habit-definitions')).json()).toEqual({
      definitions: [definition],
    });
  });
  it('returns safe habit summaries, filters recorded zero counts, exports all eight groups and protects older clients', async () => {
    const date = '2026-01-01';
    const entry = {
      ...emptyEntry(date),
      habits: [{ ...customHabit, count: 0, times: [], durationMinutes: 0 }],
    };
    expect((await call(`/api/entries/${date}`, 'PUT', { entry, revision: 0 })).status).toBe(201);
    await call('/api/entries/2026-01-02', 'PUT', { entry: emptyEntry('2026-01-02'), revision: 0 });
    const list = (await (await call(`/api/entries?habit=${customHabit.key}`)).json()) as {
      entries: Record<string, unknown>[];
      total: number;
    };
    expect(list.total).toBe(1);
    expect(list.entries[0]).toHaveProperty('habits.0.count', 0);
    expect(list.entries[0]).not.toHaveProperty('habits.0.notes');
    expect(JSON.stringify(await (await call('/api/series?all=true')).json())).not.toContain(
      'Oryginalny',
    );
    expect((await call('/api/entries?habit=invalid')).status).toBe(400);
    const { habits: _habits, ...legacy } = entry;
    expect((await call(`/api/entries/${date}`, 'PUT', { entry: legacy, revision: 1 })).status).toBe(
      409,
    );
    expect(
      (await call(`/api/entries/${date}`, 'PUT', { entry: { ...entry, habits: [] }, revision: 1 }))
        .status,
    ).toBe(200);
    const full = await call('/api/export?from=2026-01-01&to=2026-01-02');
    expect(full.status).toBe(200);
    expect(await full.json()).toHaveProperty('groups.7', 'habits');
    actor = 'owner-b';
    expect(await (await call(`/api/entries?habit=${customHabit.key}`)).json()).toMatchObject({
      total: 0,
    });
  });
  it('returns complete owner-scoped journal bounds independently of pagination', async () => {
    for (const date of ['2005-01-01', '2005-06-01', '2006-01-01'])
      await call(`/api/entries/${date}`, 'PUT', { entry: emptyEntry(date), revision: 0 });
    actor = 'owner-b';
    await call('/api/entries/2000-01-01', 'PUT', { entry: emptyEntry('2000-01-01'), revision: 0 });
    actor = 'owner-a';
    expect(await (await call('/api/entries?limit=1')).json()).toMatchObject({
      total: 3,
      firstDate: '2005-01-01',
      lastDate: '2006-01-01',
    });
    expect(await (await call('/api/entries?from=2005-06-01&to=2005-12-31')).json()).toMatchObject({
      total: 1,
      firstDate: '2005-06-01',
      lastDate: '2005-06-01',
    });
    expect(await (await call('/api/entries?from=2007-01-01')).json()).toMatchObject({
      total: 0,
      firstDate: null,
      lastDate: null,
    });
  });
  it('replaces untrusted migration headers with the independently verified legacy identity', async () => {
    const forwarded: Request[] = [];
    env.APP_ORIGIN = 'https://journal.example';
    env.AUTH = {
      idFromName: () => 'test',
      get: () => ({
        fetch: async (request: Request) => {
          forwarded.push(request);
          return Response.json({ ok: true });
        },
      }),
    } as unknown as DurableObjectNamespace;
    expect(
      (
        await call(
          '/api/auth/claim',
          'POST',
          { password: 'synthetic password' },
          { 'X-Legacy-Id': 'forged', 'X-Legacy-Email': 'forged@example.test' },
        )
      ).status,
    ).toBe(200);
    expect(forwarded[0].headers.get('X-Legacy-Id')).toBe('legacy-owner');
    expect(forwarded[0].headers.get('X-Legacy-Email')).toBe('legacy@example.test');
    await call('/api/auth/register', 'POST', {}, { 'X-Legacy-Id': 'forged' });
    expect(forwarded[1].headers.has('X-Legacy-Id')).toBe(false);
    expect((await call('/api/auth/register', 'POST', { padding: 'x'.repeat(9000) })).status).toBe(
      413,
    );
    expect(forwarded).toHaveLength(2);
  });
  it('restricts administration to explicit IDs and returns aggregates without private rows', async () => {
    expect((await call('/api/admin/overview')).status).toBe(403);
    await call('/api/entries/2026-01-01', 'PUT', {
      entry: { ...emptyEntry('2026-01-01'), notes: 'private α' },
      revision: 0,
    });
    sqlite
      .prepare(
        'INSERT INTO auth_accounts(user_id,email,password_hash,recovery_hash) VALUES (?,?,?,?)',
      )
      .run(actor, 'admin@example.test', 'test-hash', 'test-code');
    sqlite.prepare('INSERT INTO administrators(user_id) VALUES (?)').run(actor);
    expect(await (await call('/api/session')).json()).toMatchObject({ id: actor, admin: true });
    const response = await call('/api/admin/overview');
    expect(response.status).toBe(200);
    const report = (await response.json()) as {
      accounts: { accounts: number };
      journal: { entries: number; payloadBytes: number };
    };
    expect(report.accounts.accounts).toBe(1);
    expect(report.journal.entries).toBe(1);
    expect(report.journal.payloadBytes).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toContain('private α');
    expect(JSON.stringify(report)).not.toContain('admin@example.test');
    actor = 'owner-b';
    expect(
      (
        await call('/api/admin/overview', 'GET', undefined, {
          'X-Admin': 'true',
          'Cf-Access-Authenticated-User-Email': 'admin@example.test',
        })
      ).status,
    ).toBe(403);
  });
  it('supports all-history analysis without mixing owners and protects imports against account changes', async () => {
    await call('/api/entries/2001-01-01', 'PUT', { entry: emptyEntry('2001-01-01'), revision: 0 });
    expect(await (await call('/api/series?all=true')).json()).toMatchObject({
      entries: [{ date: '2001-01-01' }],
    });
    expect(
      (
        await call(
          '/api/entries/2001-01-02',
          'PUT',
          { entry: emptyEntry('2001-01-02'), revision: 0 },
          { 'X-Teddmhen-Expected-User': 'someone-else' },
        )
      ).status,
    ).toBe(403);
    actor = 'owner-b';
    expect(await (await call('/api/series?all=true')).json()).toMatchObject({ entries: [] });
  });
  it('saves, reads, summarizes, searches, and deletes a real SQLite-backed entry', async () => {
    const entry = {
      ...emptyEntry('2026-10-14'),
      wellbeing: 8,
      notes: 'Long trail run context',
      trainingStatus: 'rest',
    };
    expect((await call('/api/entries/2026-10-14', 'PUT', { entry, revision: 0 })).status).toBe(201);
    const saved = (await (await call('/api/entries/2026-10-14')).json()) as Record<string, unknown>;
    expect(saved.notes).toBe(entry.notes);
    const listing = (await (await call('/api/entries?q=trail')).json()) as {
      entries: Record<string, unknown>[];
      total: number;
    };
    expect(listing.total).toBe(1);
    expect(listing.entries[0]).not.toHaveProperty('notes');
    expect(listing.entries[0].trainingLoad).toBe(0);
    expect((await call('/api/entries/2026-10-14?revision=1', 'DELETE')).status).toBe(204);
    expect((await call('/api/entries/2026-10-14')).status).toBe(404);
  });
  it('never reads or overwrites another owner’s records', async () => {
    const entry = { ...emptyEntry('2026-10-14'), notes: 'owner A private data' };
    await call('/api/entries/2026-10-14', 'PUT', { entry, revision: 0 });
    actor = 'owner-b';
    expect((await call('/api/entries/2026-10-14')).status).toBe(404);
    expect(await (await call('/api/entries')).json()).toMatchObject({ total: 0 });
    expect((await call('/api/entries/2026-10-14?revision=1', 'DELETE')).status).toBe(409);
    const exported = await (
      await call('/api/export?from=2026-10-01&to=2026-10-31&groups=notes')
    ).text();
    expect(exported).not.toContain('owner A private data');
    expect(
      (
        await call('/api/entries/2026-10-14', 'PUT', {
          entry: { ...entry, notes: 'B' },
          revision: 0,
        })
      ).status,
    ).toBe(201);
    actor = 'owner-a';
    expect(await (await call('/api/entries/2026-10-14')).json()).toMatchObject({
      notes: entry.notes,
    });
  });
  it('rejects stale revisions for updates, inserts, and deletes', async () => {
    const entry = emptyEntry('2026-10-14');
    await call('/api/entries/2026-10-14', 'PUT', { entry, revision: 0 });
    expect((await call('/api/entries/2026-10-14', 'PUT', { entry, revision: 0 })).status).toBe(409);
    expect((await call('/api/entries/2026-10-14', 'PUT', { entry, revision: 1 })).status).toBe(200);
    expect((await call('/api/entries/2026-10-14', 'PUT', { entry, revision: 1 })).status).toBe(409);
    expect((await call('/api/entries/2026-10-14?revision=1', 'DELETE')).status).toBe(409);
  });
  it('validates origin, payload bounds, and inconsistent dates', async () => {
    const body = { entry: emptyEntry('2026-10-14'), revision: 0 };
    expect(
      (await call('/api/entries/2026-10-14', 'PUT', body, { Origin: 'https://evil.test' })).status,
    ).toBe(403);
    expect(
      (await call('/api/entries/2026-10-14', 'PUT', body, { 'X-Teddmhen-Request': '' })).status,
    ).toBe(403);
    expect((await call('/api/entries/2026-10-13', 'PUT', body)).status).toBe(400);
    expect(
      (await call('/api/entries/2026-10-14', 'PUT', { padding: 'a'.repeat(300_000) })).status,
    ).toBe(413);
    expect((await call('/api/export?from=1900-01-01&to=2026-10-14')).status).toBe(400);
  });
  it('paginates without duplicates and streams valid field-selected export formats', async () => {
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14'])
      await call(`/api/entries/${date}`, 'PUT', {
        entry: { ...emptyEntry(date), wellbeing: 7, notes: 'secret' },
        revision: 0,
      });
    const first = (await (await call('/api/entries?limit=2')).json()) as {
      entries: { date: string }[];
      nextCursor: string;
    };
    expect(first.entries.map((e) => e.date)).toEqual(['2026-10-14', '2026-10-13']);
    const next = (await (await call(`/api/entries?limit=2&cursor=${first.nextCursor}`)).json()) as {
      entries: { date: string }[];
    };
    expect(next.entries.map((e) => e.date)).toEqual(['2026-10-12']);
    const path = '/api/export?from=2026-10-01&to=2026-10-31&groups=ratings&fields=wellbeing';
    for (const format of ['json', 'ndjson', 'csv', 'md']) {
      const response = await call(`${path}&format=${format}`);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toContain('secret');
      if (format === 'json') {
        const result = JSON.parse(text);
        expect(result.entries).toHaveLength(3);
        expect(result.entries[0]).not.toHaveProperty('fatigue');
      }
      if (format === 'ndjson')
        expect(
          text
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line)),
        ).toHaveLength(4);
      if (format === 'csv') expect(text).toContain('"wellbeing"');
      if (format === 'md') expect(text).toContain('## 2026-10-12');
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
  });
});
