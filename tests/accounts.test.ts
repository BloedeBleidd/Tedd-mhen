import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { adapter } from './database';
import { handleAccount } from '../worker/accounts';
import { digest, readSession } from '../worker/sessions';
import { emptyEntry } from '../shared/schema';

let sqlite: DatabaseSync, db: D1Database;
const password = 'Synthetic test passphrase 2026';
const email = 'legacy@example.test';
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  sqlite.prepare('INSERT INTO users(id,email) VALUES (?,?)').run('legacy-owner', email);
  sqlite
    .prepare('INSERT INTO entries(owner_id,date,data) VALUES (?,?,?)')
    .run('legacy-owner', '2001-01-01', JSON.stringify(emptyEntry('2001-01-01')));
  sqlite.exec(readFileSync('migrations/0002_accounts.sql', 'utf8'));
  db = adapter(sqlite);
});
afterEach(() => sqlite.close());
function call(
  action: string,
  body: unknown,
  cookie = '',
  extra: Record<string, string> = {},
  allow = true,
) {
  return handleAccount(
    new Request(`https://test.example/api/auth/${action}`, {
      method: 'POST',
      headers: {
        Origin: 'https://test.example',
        'X-Teddmhen-Request': '1',
        'Content-Type': 'application/json',
        Cookie: cookie,
        ...extra,
      },
      body: JSON.stringify(body),
    }),
    { DB: db },
    async () => allow,
  );
}
const claim = () =>
  call('claim', { password }, '', { 'X-Legacy-Id': 'legacy-owner', 'X-Legacy-Email': email });
const session = (cookie: string) =>
  readSession(new Request('https://test.example', { headers: { Cookie: cookie } }), db);
describe('Credential transactions and legacy migration', () => {
  it('rejects stale workspace credentials for password changes, logout and deletion', async () => {
    const response = await claim();
    const cookie = response.headers.get('set-cookie')!;
    expect(await response.json()).toMatchObject({ userId: 'legacy-owner' });
    for (const action of ['change-password', 'logout', 'delete-account']) {
      const body =
        action === 'change-password'
          ? { currentPassword: password, password: password + 'new' }
          : action === 'delete-account'
            ? { currentPassword: password }
            : {};
      expect(
        (await call(action, body, cookie, { 'X-Teddmhen-Expected-User': 'another-owner' })).status,
      ).toBe(403);
      expect(await session(cookie)).toMatchObject({ id: 'legacy-owner' });
    }
    expect(
      (await call('logout', {}, cookie, { 'X-Teddmhen-Expected-User': 'legacy-owner' })).status,
    ).toBe(200);
    expect(await session(cookie)).toBeNull();
  });
  it('reserves legacy email and claims the exact existing journal without copying records', async () => {
    expect((await call('register', { email, password })).status).toBe(409);
    expect(
      (
        await call('claim', { password }, '', {
          'X-Legacy-Id': 'different-subject',
          'X-Legacy-Email': email,
        })
      ).status,
    ).toBe(409);
    const response = await claim();
    expect(response.status).toBe(200);
    expect(await session(response.headers.get('set-cookie')!)).toMatchObject({
      id: 'legacy-owner',
    });
    expect(sqlite.prepare('SELECT owner_id FROM entries').all()).toEqual([
      { owner_id: 'legacy-owner' },
    ]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM users').get()?.n).toBe(1);
    expect((await claim()).status).toBe(409);
  });
  it('allows exactly one concurrent recovery and never stores raw recovery or session secrets', async () => {
    const response = await claim();
    const cookie = response.headers.get('set-cookie')!;
    const { recoveryCode } = (await response.json()) as { recoveryCode: string };
    const results = await Promise.all([
      call('recover', { email, password: password + 'A', code: recoveryCode }),
      call('recover', { email, password: password + 'B', code: recoveryCode }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => [401, 409].includes(r.status))).toHaveLength(1);
    expect(await session(cookie)).toBeNull();
    const stored = sqlite.prepare('SELECT * FROM auth_accounts').get()!;
    expect(JSON.stringify(stored)).not.toContain(recoveryCode);
    expect(JSON.stringify(stored)).not.toContain(password);
    expect(stored.recovery_hash).not.toBe(await digest(recoveryCode));
    expect((await call('recover', { email, password, code: recoveryCode })).status).toBe(401);
  });
  it('requires the current password, rotates credentials, expires sessions and deletes only the account owner', async () => {
    const response = await claim();
    const cookie = response.headers.get('set-cookie')!;
    expect((await call('delete-account', { currentPassword: 'incorrect' }, cookie)).status).toBe(
      401,
    );
    const changed = await call(
      'change-password',
      { currentPassword: password, password: password + 'new' },
      cookie,
    );
    expect(changed.status).toBe(200);
    expect(await session(cookie)).toBeNull();
    const nextCookie = changed.headers.get('set-cookie')!;
    expect(await session(nextCookie)).not.toBeNull();
    await call('register', { email: 'second@example.test', password });
    expect(
      (await call('delete-account', { currentPassword: password + 'new' }, nextCookie)).status,
    ).toBe(200);
    expect(await session(nextCookie)).toBeNull();
    expect(sqlite.prepare('SELECT count(*) AS n FROM entries').get()?.n).toBe(0);
    expect(sqlite.prepare('SELECT email FROM auth_accounts').all()).toEqual([
      { email: 'second@example.test' },
    ]);
    const logged = await call('login', { email: 'SECOND@example.test', password });
    const loggedCookie = logged.headers.get('set-cookie')!;
    sqlite.exec('UPDATE auth_sessions SET expires_at=0');
    expect(await session(loggedCookie)).toBeNull();
  });
  it('rejects rate-limited requests before password work or database mutation', async () => {
    const response = await call('register', { email: 'new@example.test', password }, '', {}, false);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('600');
    expect(sqlite.prepare('SELECT count(*) AS n FROM auth_accounts').get()?.n).toBe(0);
  });
});
