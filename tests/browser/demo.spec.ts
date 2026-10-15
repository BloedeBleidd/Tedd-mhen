import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { emptyEntry } from '../../shared/schema';

test('demo editing, multi-row import and marked export stay isolated and reset on return', async ({
  page,
  request,
}) => {
  const date = '2003-04-05';
  const own = { ...emptyEntry(date), wellbeing: 8, notes: 'Personal synthetic fixture' };
  await request.put(`/api/entries/${date}`, {
    headers: { 'X-Teddmhen-Request': '1' },
    data: { entry: own, revision: 0 },
  });
  const writes: string[] = [];
  page.on('request', (r) => {
    if (['PUT', 'POST', 'DELETE'].includes(r.method())) writes.push(r.url());
  });
  await page.goto(`/check-in?date=${date}`);
  await expect(page.getByRole('slider', { name: 'Wellbeing', exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByRole('button', { name: 'Explore a demo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
  expect(await (await request.get(`/api/entries/${date}`)).json()).toMatchObject({
    wellbeing: 8,
    notes: own.notes,
    revision: 1,
  });
  expect((await request.get('/api/entries/2003-04-06')).status()).toBe(404);
  await page.getByRole('button', { name: 'Use my data' }).click();
  await expect(page.getByText('DEMO DATA', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('From', { exact: true })).not.toHaveValue('2003-04-05');
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByRole('button', { name: 'Explore a demo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill('Demo batch example');
  await expect(page.getByRole('link', { name: /6 Apr 2003/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Use my data' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await request.delete(`/api/entries/${date}?revision=1`, {
    headers: { 'X-Teddmhen-Request': '1' },
  });
});

test('loading can be cancelled, failure leaves the journal intact, and retry works', async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const arrived = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route('**/api/demo', async (route) => {
    started();
    await held;
    await route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await arrived;
  await expect(page.getByRole('button', { name: 'Explore a demo' })).toBeDisabled();
  await page.getByRole('button', { name: 'Use my data' }).click();
  release();
  await expect(page.getByRole('button', { name: 'Explore a demo' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Use my data' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.unroute('**/api/demo');
  await page.route('**/api/demo', (route) =>
    route.fulfill({ status: 503, json: { error: 'Demo is temporarily unavailable.' } }),
  );
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByRole('alert')).toContainText('Demo is temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Use my data' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.unroute('**/api/demo');
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByText('DEMO DATA', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('bottom switcher stays visible across themes, narrow screens and all supporting pages without covering save actions', async ({
  page,
}) => {
  await page.goto('/');
  const dock = page.getByRole('region', { name: 'Data workspace' });
  await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      await expect(dock).toBeVisible();
      const bounds = await dock.boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/demo-switch-${theme}-${width}.png`,
        animations: 'disabled',
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByText('DEMO DATA', { exact: true })).toBeVisible();
  for (const name of ['Account', 'Guide & methodology', 'Privacy & data', 'About the author']) {
    await page
      .getByRole('link', { name, exact: name !== 'Guide & methodology' })
      .first()
      .click();
    await expect(dock).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Daily check-in', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Save check-in' }).scrollIntoViewIfNeeded();
  const save = await page.getByRole('button', { name: 'Save check-in' }).boundingBox();
  const dockBounds = await dock.boundingBox();
  expect(save!.y + save!.height).toBeLessThanOrEqual(dockBounds!.y);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await dock.evaluate(
      (node) =>
        node.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
    ),
  ).toBe(0);
});

test('two signed-in accounts share the fixed demo but retain separate private journals', async ({
  playwright,
}) => {
  const origin = 'http://127.0.0.1:8789';
  const contexts = await Promise.all(
    [0, 1].map(() =>
      playwright.request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin, 'X-Teddmhen-Request': '1' },
      }),
    ),
  );
  const password = `demo test ${crypto.randomUUID()}`;
  try {
    expect((await contexts[0].get('/api/demo')).status()).toBe(401);
    for (const context of contexts)
      expect(
        (
          await context.post('/api/auth/register', {
            data: { email: `demo-${crypto.randomUUID()}@example.test`, password },
          })
        ).status(),
      ).toBe(200);
    const a = await (await contexts[0].get('/api/demo')).json();
    const b = await (await contexts[1].get('/api/demo')).json();
    expect(a.entries).toEqual(b.entries);
    expect(a.viewerId).not.toBe(b.viewerId);
    const date = a.anchorDate;
    expect(
      (
        await contexts[0].put(`/api/entries/${date}`, {
          data: {
            entry: { ...emptyEntry(date), wellbeing: 9, notes: 'Private synthetic observation' },
            revision: 0,
          },
        })
      ).status(),
    ).toBe(201);
    expect((await contexts[1].get(`/api/entries/${date}`)).status()).toBe(404);
    expect((await (await contexts[0].get('/api/demo')).json()).entries).toEqual(a.entries);
    expect((await contexts[1].get('/api/admin/overview')).status()).toBe(403);
  } finally {
    for (const context of contexts) {
      await context.post('/api/auth/delete-account', { data: { currentPassword: password } });
      await context.dispose();
    }
  }
});

test('an active import blocks switching and a later switch clears its preview', async ({
  page,
  request,
}) => {
  const date = '2003-05-01';
  let release!: () => void, started!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const arrived = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route(`**/api/entries/${date}`, async (route) => {
    if (route.request().method() === 'GET') {
      started();
      await held;
    }
    await route.continue();
  });
  await page.goto('/import');
  await page.getByLabel('Journal export file').setInputFiles({
    name: 'pending.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([{ date, wellbeing: 8 }])),
  });
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Import reviewed observations' }).click();
  await arrived;
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.locator('.workspace-error')).toContainText('Workspace unchanged');
  await expect(page.getByRole('button', { name: 'Use my data' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  release();
  await expect(page.getByText('1 days saved · 0 skipped · 0 failed')).toBeVisible();
  await page.getByRole('button', { name: 'Explore a demo' }).click();
  await expect(page.getByText('DEMO DATA', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import reviewed observations' })).toHaveCount(0);
  await expect(page.getByLabel('Journal export file')).toHaveValue('');
  expect(await (await request.get(`/api/entries/${date}`)).json()).toMatchObject({
    wellbeing: 8,
    revision: 1,
  });
  await request.delete(`/api/entries/${date}?revision=1`, {
    headers: { 'X-Teddmhen-Request': '1' },
  });
});
