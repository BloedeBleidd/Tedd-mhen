import { test, expect } from '@playwright/test';
import { emptyEntry } from '../../shared/schema';
test.use({ baseURL: 'http://127.0.0.1:8789' });
const origin = 'http://127.0.0.1:8789';
const headers = { Origin: origin, 'X-Teddmhen-Request': '1' };
const password = 'synthetic pilot password 2026';

test('public registration, one-time recovery, account isolation and deletion', async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: headers });
  const b = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: headers });
  const emailA = `pilot-a-${crypto.randomUUID()}@example.test`;
  const emailB = `pilot-b-${crypto.randomUUID()}@example.test`;
  expect((await a.get('/api/entries')).status()).toBe(401);
  const signup = await a.post('/api/auth/register', { data: { email: emailA, password } });
  expect(signup.status()).toBe(200);
  const firstCode = (await signup.json()).recoveryCode;
  expect(firstCode).toMatch(/^TMH-/);
  const oldSession = await a.storageState();
  const old = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
    storageState: oldSession,
  });
  expect((await b.post('/api/auth/register', { data: { email: emailB, password } })).status()).toBe(
    200,
  );
  const date = '2002-03-04';
  expect(
    (
      await a.put(`/api/entries/${date}`, {
        data: {
          entry: { ...emptyEntry(date), notes: 'Synthetic account A private record' },
          revision: 0,
        },
      })
    ).status(),
  ).toBe(201);
  expect((await b.get(`/api/entries/${date}`)).status()).toBe(404);
  expect(
    (
      await (
        await b.get('/api/export?from=2002-03-04&to=2002-03-04&format=json&groups=notes')
      ).json()
    ).entries,
  ).toHaveLength(0);
  const recovery = await a.post('/api/auth/recover', {
    data: { email: emailA, password: password + 'new', code: firstCode },
  });
  expect(recovery.status()).toBe(200);
  const secondCode = (await recovery.json()).recoveryCode;
  expect(secondCode).not.toBe(firstCode);
  expect((await old.get('/api/entries')).status()).toBe(401);
  expect(
    (
      await a.post('/api/auth/recover', { data: { email: emailA, password, code: firstCode } })
    ).status(),
  ).toBe(401);
  expect((await a.get(`/api/entries/${date}`)).status()).toBe(200);
  expect(
    (
      await a.post('/api/auth/delete-account', { data: { currentPassword: password + 'new' } })
    ).status(),
  ).toBe(200);
  expect((await a.get('/api/entries')).status()).toBe(401);
  expect(
    (await b.post('/api/auth/delete-account', { data: { currentPassword: password } })).status(),
  ).toBe(200);
  await Promise.all([a.dispose(), b.dispose(), old.dispose()]);
});

test('registration UI preserves recovery code until acknowledgement, sign out and sign in', async ({
  page,
}) => {
  const email = `browser-${crypto.randomUUID()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel(/^New password/).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I have read/ }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Save your recovery code.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to my journal' })).toBeDisabled();
  const code = await page.getByLabel('Recovery code', { exact: true }).textContent();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(code);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Clipboard denied')) },
      configurable: true,
    });
  });
  await page.getByRole('button', { name: 'Copy recovery code' }).click();
  await expect(page.getByRole('alert')).toContainText('copy it manually');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Tedd’mhen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Save your recovery code.' })).toBeVisible();
  await page.getByRole('checkbox', { name: /I have saved/ }).check();
  await page.getByRole('button', { name: 'Continue to my journal' }).click();
  await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible();
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeEnabled();
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 503, json: { error: 'Session unavailable after logout.' } }),
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByRole('link', { name: 'Tedd’mhen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Could not open your journal.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.unroute('**/api/session');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Try demo', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible();
});

test('credential endpoints reject cross-origin writes, short passwords and forged legacy claims', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/auth/register', {
        headers: { ...headers, Origin: 'https://evil.example' },
        data: { email: 'bad@example.test', password },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/auth/register', {
        headers,
        data: { email: 'bad@example.test', password: 'short' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/auth/claim', {
        headers: {
          ...headers,
          'X-Legacy-Id': 'owner',
          'X-Legacy-Email': 'owner@example.test',
          'Cf-Access-Jwt-Assertion': 'fake',
        },
        data: { password },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get('/api/entries', {
        headers: { 'Cf-Access-Authenticated-User-Email': 'owner@example.test' },
      })
    ).status(),
  ).toBe(401);
});

test('repeated incorrect credentials are throttled in the persistent account service', async ({
  request,
}) => {
  const email = `limited-${crypto.randomUUID()}@example.test`;
  for (let attempt = 0; attempt < 10; attempt++) {
    expect(
      (await request.post('/api/auth/login', { headers, data: { email, password } })).status(),
    ).toBe(401);
  }
  const blocked = await request.post('/api/auth/login', { headers, data: { email, password } });
  expect(blocked.status()).toBe(429);
  expect(blocked.headers()['retry-after']).toBe('600');
});
