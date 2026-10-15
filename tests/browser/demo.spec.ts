import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { emptyEntry } from '../../shared/schema';

test('demo editing, multi-row import and marked export stay isolated and reset on return', async ({
  page,
  request,
}) => {
  const date = '2003-04-05';
  const writes: string[] = [];
  page.on('request', (r) => {
    if (['PUT', 'POST', 'DELETE'].includes(r.method())) writes.push(r.url());
  });
  await page.goto(`http://127.0.0.1:8789/demo/check-in?date=${date}`);
  await expect(page.getByRole('checkbox', { name: 'Wellbeing', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Wellbeing', exact: true }).check();
  await page.getByRole('slider', { name: 'Wellbeing', exact: true }).fill('3');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved in demo memory')).toBeVisible();
  await page.getByRole('link', { name: 'Import data', exact: true }).click();
  await page.getByLabel('Journal export file').setInputFiles({
    name: 'demo-experiment.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        { ...emptyEntry('2003-04-06'), wellbeing: 6, notes: 'Demo batch example' },
        { ...emptyEntry('2003-04-07'), wellbeing: 7, notes: 'Demo batch example' },
      ]),
    ),
  });
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Import reviewed observations' }).click();
  await expect(page.getByText('2 days saved · 0 skipped · 0 failed')).toBeVisible();
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill('Demo batch example');
  await expect(page.getByRole('link', { name: /6 Apr 2003/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /7 Apr 2003/ })).toBeVisible();
  await page.getByRole('link', { name: 'Export data', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Take the full picture with you.' }),
  ).toBeVisible();
  await page.getByLabel('From', { exact: true }).fill('2003-04-05');
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2003-04-05');
  await page.getByLabel('To', { exact: true }).fill('2003-04-07');
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('2003-04-07');
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2003-04-05');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download export' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toContain('teddmhen-demo-');
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(exported.synthetic).toBe(true);
  expect(exported.entries.map((entry: { wellbeing: number }) => entry.wellbeing)).toEqual([
    3, 6, 7,
  ]);
  expect(writes).toEqual([]);
  expect((await request.get('http://127.0.0.1:8789/api/entries')).status()).toBe(401);
  await page
    .getByRole('navigation', { name: 'Account access' })
    .getByRole('link', { name: 'Sign in', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByRole('link', { name: 'Try demo — no account needed' }).click();
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill('Demo batch example');
  await expect(page.getByRole('link', { name: /6 Apr 2003/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('DEMO DATA', { exact: true })).toBeVisible();
});

test('demo failure can be retried and leaving a pending load cannot open a stale workspace', async ({
  page,
}) => {
  await page.route('**/api/demo', (route) =>
    route.fulfill({ status: 503, json: { error: 'Demo is temporarily unavailable.' } }),
  );
  await page.goto('http://127.0.0.1:8789/demo');
  await expect(page.getByRole('alert')).toContainText('Demo is temporarily unavailable');
  await page.unroute('**/api/demo');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Account access' })
    .getByRole('link', { name: 'Sign in' })
    .click();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/demo', async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole('link', { name: 'Try demo — no account needed' }).click();
  await expect(page.getByRole('heading', { name: 'Explore the demo.' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Account access' })
    .getByRole('link', { name: 'Create account' })
    .click();
  release();
  await expect(page.getByRole('heading', { name: 'Make room for your rhythm.' })).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
});

test('mobile visitors can enter before registration, explore every page and leave without an overlay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8789/');
  const entry = page.getByRole('link', { name: 'Try demo', exact: true });
  await expect(entry).toBeInViewport();
  await entry.click();
  await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Data workspace' })).toHaveCount(0);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  const close = page
    .locator('.sidebar')
    .getByRole('button', { name: 'Close navigation', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.locator('.sidebar').getByRole('link', { name: 'Guide & methodology', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  const banner = page.getByRole('complementary', { name: 'Demo information' });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      await expect(banner).toBeInViewport();
      const create = banner.getByRole('link', { name: 'Create account' });
      await expect(create).toBeInViewport();
      const box = await create.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await page.screenshot({
        path: `test-results/public-demo-${theme}-${width}.png`,
        animations: 'disabled',
      });
    }
  }
  const routes = [
    ['Daily check-in', '/demo/check-in'],
    ['Journal', '/demo/journal'],
    ['Trends & predictions', '/demo/analysis'],
    ['Export data', '/demo/export'],
    ['Import data', '/demo/import'],
    ['Account', '/demo/account'],
    ['Guide & methodology', '/demo/help'],
    ['Privacy & data', '/demo/privacy'],
  ];
  for (const [name, path] of routes) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.locator('.sidebar').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:8789${path}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main .loading')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
        message: path,
      })
      .toBe(true);
  }
  await page.getByRole('link', { name: 'About the author', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:8789/demo/about');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Piotr Żmuda.' })).toBeVisible();
  await banner.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:8789/register');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  expect(
    await page.getByLabel('Email', { exact: true }).evaluate((e) => getComputedStyle(e).fontSize),
  ).toBe('16px');
});

test('signed-in users have no demo controls and a demo URL returns to their private journal', async ({
  page,
}) => {
  const origin = 'http://127.0.0.1:8789';
  const password = `demo isolation ${crypto.randomUUID()}`;
  const headers = { Origin: origin, 'X-Teddmhen-Request': '1' };
  expect((await page.request.get(`${origin}/api/demo`)).status()).toBe(200);
  expect((await page.request.get(`${origin}/api/entries`)).status()).toBe(401);
  const baseline = await (await page.request.get(`${origin}/api/demo`)).json();
  expect(baseline).not.toHaveProperty('viewerId');
  try {
    expect(
      (
        await page.request.post(`${origin}/api/auth/register`, {
          headers,
          data: { email: `public-demo-${crypto.randomUUID()}@example.test`, password },
        })
      ).status(),
    ).toBe(200);
    await page.goto(`${origin}/demo/analysis/relationships`);
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible();
    await expect(page.locator('a[href^="/demo"], .demo-banner, .workspace-switcher')).toHaveCount(
      0,
    );
    expect((await (await page.request.get(`${origin}/api/entries`)).json()).entries).toEqual([]);
    expect(await (await page.request.get(`${origin}/api/demo`)).json()).toEqual(baseline);
  } finally {
    await page.request.post(`${origin}/api/auth/delete-account`, {
      headers,
      data: { currentPassword: password },
    });
  }
});

test('unsaved demo edits can keep visitors in the demo before leaving for registration', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:8789/demo/check-in?date=2003-05-01');
  await page.getByRole('checkbox', { name: 'Energy', exact: true }).check();
  const dismissed = new Promise<void>((resolve) =>
    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
      resolve();
    }),
  );
  await page
    .getByRole('navigation', { name: 'Account access' })
    .getByRole('link', { name: 'Create account' })
    .click();
  await dismissed;
  await expect(page.getByRole('heading', { name: 'How was your day?' })).toBeVisible();
  const accepted = new Promise<void>((resolve) =>
    page.once('dialog', async (dialog) => {
      await dialog.accept();
      resolve();
    }),
  );
  await page
    .getByRole('navigation', { name: 'Account access' })
    .getByRole('link', { name: 'Create account' })
    .click();
  await accepted;
  await expect(page.getByRole('heading', { name: 'Make room for your rhythm.' })).toBeVisible();
  await page.getByRole('link', { name: 'Try demo — no account needed' }).click();
  await page.getByRole('link', { name: 'Import data', exact: true }).click();
  await expect(page.getByLabel('Journal export file')).toHaveValue('');
});
