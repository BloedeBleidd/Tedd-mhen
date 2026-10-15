import { test, expect } from '@playwright/test';
import { emptyEntry } from '../../shared/schema';
import { readFile } from 'node:fs/promises';

test.use({ baseURL: 'http://127.0.0.1:8789' });
const origin = 'http://127.0.0.1:8789';
const headers = { Origin: origin, 'X-Teddmhen-Request': '1' };
const password = 'Synthetic review passphrase 2026';

test('a stale workspace cannot save or export into the account opened in another tab', async ({
  page,
  playwright,
}) => {
  const a = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: headers });
  const b = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: headers });
  try {
    for (const account of [a, b])
      expect(
        (
          await account.post('/api/auth/register', {
            data: { email: `review-${crypto.randomUUID()}@example.test`, password },
          })
        ).status(),
      ).toBe(200);
    const userA = (await (await a.get('/api/session')).json()).id;
    await page.context().addCookies((await a.storageState()).cookies);
    await page.goto('/check-in?date=2005-06-01');
    await page.getByRole('checkbox', { name: 'Wellbeing', exact: true }).check();
    await page.getByRole('slider', { name: 'Wellbeing', exact: true }).fill('7');
    await page.context().addCookies((await b.storageState()).cookies);
    const save = page.waitForRequest((r) => r.method() === 'PUT');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    expect((await save).headers()['x-teddmhen-expected-user']).toBe(userA);
    await expect(page.getByRole('alert')).toContainText('account changed');
    expect((await b.get('/api/entries/2005-06-01')).status()).toBe(404);
    await page.context().addCookies((await a.storageState()).cookies);
    expect(
      (
        await a.put('/api/entries/2005-06-01', {
          data: { entry: { ...emptyEntry('2005-06-01'), wellbeing: 5 }, revision: 0 },
        })
      ).ok(),
    ).toBe(true);
    await page.goto('/export');
    await page.getByRole('button', { name: 'Select complete JSON backup' }).click();
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2005-06-01');
    await expect(page.getByRole('button', { name: 'Download export' })).toBeEnabled();
    await page.evaluate(() => {
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    });
    await page.context().addCookies((await b.storageState()).cookies);
    const exported = page.waitForRequest('**/api/export?*');
    await page.getByRole('button', { name: 'Download export' }).click();
    expect((await exported).headers()['x-teddmhen-expected-user']).toBe(userA);
    await expect(page.getByRole('alert')).toContainText('account changed');
  } finally {
    for (const account of [a, b]) {
      await account.post('/api/auth/delete-account', { data: { currentPassword: password } });
      await account.dispose();
    }
  }
});

test('historical journals, visible account validation, and in-flight check-in protection work on mobile', async ({
  page,
  playwright,
}) => {
  const account = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  try {
    expect(
      (
        await account.post('/api/auth/register', {
          data: { email: `history-${crypto.randomUUID()}@example.test`, password },
        })
      ).ok(),
    ).toBe(true);
    await account.put('/api/entries/2005-06-02', {
      data: { entry: { ...emptyEntry('2005-06-02'), wellbeing: 4 }, revision: 0 },
    });
    await page.context().addCookies((await account.storageState()).cookies);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'No entries in the last 28 days.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Record your first day' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Explore your journal' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Find connections/ })).toHaveAttribute(
      'href',
      '/analysis/relationships',
    );
    await page.goto('/account');
    await page.getByLabel('Current password', { exact: true }).fill(password);
    await page.getByLabel(/^New password/).fill('short');
    await page.getByLabel('Confirm new password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Change password & recovery code' }).click();
    await expect(page.getByRole('alert')).toContainText('at least 12 characters');
    await expect(page.getByRole('alert')).toBeInViewport();
    await page.goto('/check-in?date=2005-06-03');
    await expect(page.getByRole('navigation', { name: 'Check-in sections' })).toBeVisible();
    await page.getByLabel('Actual sleep (minutes)').fill('2000');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByRole('alert')).toContainText('Actual sleep');
    await expect(page.getByRole('alert')).toBeInViewport();
    await page.getByLabel('Actual sleep (minutes)').fill('450');
    await page.route('**/api/session', (route) =>
      route.fulfill({ status: 503, json: { error: 'Background session refresh unavailable.' } }),
    );
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/entries/2005-06-03', async (route) => {
      if (route.request().method() === 'PUT') await held;
      await route.continue();
    });
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByLabel('Journal date')).toBeDisabled();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('link', { name: 'Journal', exact: true }).click();
    await expect(page).toHaveURL(/check-in/);
    release();
    await expect(page.getByText('Saved to your journal', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Journal date')).toBeEnabled();
    await expect(
      page.getByText('Background session refresh unavailable.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Actual sleep (minutes)')).toHaveValue('450');
    await page.unroute('**/api/session');
    await page.getByRole('button', { name: 'Retry connection' }).click();
    await expect(
      page.getByText('Background session refresh unavailable.', { exact: true }),
    ).toHaveCount(0);
    expect(
      (await (await account.get('/api/entries/2005-06-03')).json()).sleep.durationMinutes,
    ).toBe(450);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await account.post('/api/auth/delete-account', { data: { currentPassword: password } });
    await account.dispose();
  }
});

test('a session outage shows retry instead of a misleading signed-out screen', async ({ page }) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 503, json: { error: 'Session temporarily unavailable.' } }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Could not open your journal.' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Session temporarily unavailable.');
  await page.unroute('**/api/session');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('link', { name: /Try demo/ })).toBeVisible();
});

test('demo backup includes every data group and analysis recovers from unavailable workers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/demo');
  await expect(page.getByRole('link', { name: /Find connections/ })).toHaveAttribute(
    'href',
    '/demo/analysis/relationships',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'test-results/review-demo-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/demo/export');
  await page.getByRole('button', { name: 'Select complete JSON backup' }).click();
  await expect(page.getByText('7 of 7', { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download export' }).click();
  const file = await downloaded;
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(exported.count).toBe(236);
  expect(exported.groups).toHaveLength(7);
  expect(
    exported.entries.every(
      (e: { labels?: unknown; notes?: unknown }) => 'labels' in e && 'notes' in e,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    window.Worker = class {
      constructor() {
        throw new Error('Worker unavailable');
      }
    } as unknown as typeof Worker;
  });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Trends & predictions', exact: true }).click();
  await page.getByRole('link', { name: 'Multivariable model', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Analysis could not run');
  await expect(
    page.getByRole('heading', { name: 'Put your observations together.' }),
  ).toBeVisible();
});

test('changing analysis dates excludes unavailable labels and allows only meaningful same-day comparisons', async ({
  page,
}) => {
  await page.goto('/demo/import');
  await page.getByLabel('Journal export file').setInputFiles({
    name: 'label-boundary.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([{ ...emptyEntry('2004-01-01'), wellbeing: 6, labels: ['boundary context'] }]),
    ),
  });
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Import reviewed observations' }).click();
  await expect(page.getByText('1 days saved · 0 skipped · 0 failed')).toBeVisible();
  await page.getByRole('link', { name: 'Trends & predictions', exact: true }).click();
  await page.getByRole('link', { name: 'Multivariable model', exact: true }).click();
  await page.getByRole('checkbox', { name: 'All recorded dates' }).check();
  await page.getByText(/^Choose inputs: metrics & labels/).click();
  await page.getByLabel('Find an input').fill('boundary context');
  await page.getByRole('checkbox', { name: /Context: boundary context/ }).check();
  await page.getByRole('checkbox', { name: 'All recorded dates' }).uncheck();
  await expect(
    page.getByText(
      'Some selected inputs have no matching observations and are excluded. Open Choose inputs to review them.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conditional associations' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('link', { name: 'Relationships', exact: true }).click();
  await page.getByRole('combobox', { name: 'Outcome', exact: true }).selectOption('sleepHours');
  await expect(page.getByLabel('Compare with')).not.toHaveValue('sleepHours');
  await page.getByLabel('Outcome occurs').selectOption('1');
  await page.getByLabel('Compare with').selectOption('sleepHours');
  await expect(
    page.getByRole('heading', { name: 'Strongest observed associations' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
