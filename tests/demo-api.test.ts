import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/index';
import type { Env } from '../worker/auth';
import { DEMO_OWNER } from '../shared/demo';
import { emptyEntry, type StoredEntry } from '../shared/schema';
import { adapter } from './database';
let actor: string | null = 'a';
vi.mock('../worker/auth', () => ({
  authenticate: async () => {
    if (!actor) throw Response.json({ error: 'Sign in first.' }, { status: 401 });
    return { id: actor, email: `${actor}@example.test` };
  },
  isLocal: () => false,
}));
let sqlite: DatabaseSync, env: Env;
const call = (path: string, method = 'GET', body?: unknown, headers?: Record<string, string>) =>
  worker.fetch(
    new Request(`https://journal.example${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Teddmhen-Request': '1', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
beforeEach(() => {
  actor = 'a';
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  readdirSync('migrations')
    .sort()
    .forEach((name) => sqlite.exec(readFileSync(`migrations/${name}`, 'utf8')));
  env = { DB: adapter(sqlite) } as Env;
});
afterEach(() => sqlite.close());
describe('Authenticated, fixed-owner demo endpoint', () => {
  it('shares only the synthetic baseline, never private records, and leaves personal endpoints owner-scoped', async () => {
    const date = '2026-10-01';
    await call(`/api/entries/${date}`, 'PUT', {
      entry: { ...emptyEntry(date), notes: 'private test A' },
      revision: 0,
    });
    const first = await call('/api/demo');
    expect(first.status).toBe(200);
    expect(first.headers.get('Cache-Control')).toBe('private, no-store');
    const a = (await first.json()) as { viewerId: string; entries: StoredEntry[] };
    expect(a.viewerId).toBe('a');
    expect(a.entries).toHaveLength(236);
    expect(JSON.stringify(a)).not.toContain('private test A');
    expect(JSON.stringify(a)).not.toContain(DEMO_OWNER);
    actor = 'b';
    const b = (await (await call('/api/demo')).json()) as typeof a;
    expect(b.entries).toEqual(a.entries);
    expect(b.viewerId).toBe('b');
    expect(await (await call('/api/entries?owner_id=system-demo-v1')).json()).toMatchObject({
      entries: [],
      total: 0,
    });
    expect((await call(`/api/entries/${date}?owner_id=a`)).status).toBe(404);
    expect(await (await call('/api/series?all=true&owner_id=system-demo-v1')).json()).toMatchObject(
      { entries: [] },
    );
    expect(
      await (
        await call(
          '/api/export?from=2026-10-01&to=2026-10-01&format=json&groups=ratings&owner_id=system-demo-v1',
        )
      ).json(),
    ).toMatchObject({ entries: [] });
    expect((await call('/api/demo?owner_id=a')).status).toBe(400);
    for (const method of ['POST', 'PUT', 'DELETE'])
      expect((await call('/api/demo', method)).status).toBe(405);
    actor = null;
    expect(
      (
        await call('/api/demo', 'GET', undefined, {
          'Cf-Access-Authenticated-User-Email': 'fake@example.test',
        })
      ).status,
    ).toBe(401);
  });
  it('fails explicitly when a configured dataset is absent or incomplete', async () => {
    sqlite.exec('UPDATE demo_datasets SET record_count=237');
    expect((await call('/api/demo')).status).toBe(503);
    sqlite.exec('DELETE FROM demo_datasets');
    expect((await call('/api/demo')).status).toBe(503);
  });
});
