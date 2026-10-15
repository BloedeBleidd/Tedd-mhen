import { test, expect } from '@playwright/test';
import { emptyEntry } from '../../shared/schema';

test('administrator dashboard exposes aggregate statistics to the granted fixture account', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Administration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The project, in numbers.' })).toBeVisible();
  await expect(page.getByText('Registered accounts', { exact: true })).toBeVisible();
  await expect(page.getByText('Journal JSON payload', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Activity and coverage' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('a[href^="/demo"]')).toHaveCount(0);
});

test('stopping an import during a read prevents sending that row and later rows', async ({
  page,
  request,
}) => {
  const date = '2000-06-10';
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrive!: () => void;
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  await page.route(`**/api/entries/${date}`, async (route) => {
    arrive();
    await held;
    await route.continue();
  });
  await page.goto('/import');
  await page.getByLabel('Journal export file').setInputFiles({
    name: 'cancel.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        { date, wellbeing: 8 },
        { date: '2000-06-11', wellbeing: 7 },
      ]),
    ),
  });
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Import reviewed observations' }).click();
  await arrived;
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await expect(page).toHaveURL(/\/import$/);
  await page.getByRole('button', { name: 'Stop import', exact: true }).click();
  release();
  await expect(page.getByRole('alert')).toContainText('Import stopped');
  expect((await request.get(`/api/entries/${date}`)).status()).toBe(404);
  expect((await request.get('/api/entries/2000-06-11')).status()).toBe(404);
});

test('relationships and multivariable predictions use demo observations, expose methods and export a reproducible model', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8789/demo');
  await page.getByRole('link', { name: 'Trends & predictions', exact: true }).click();
  await page.getByRole('link', { name: 'Relationships', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What moves together?' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Strongest observed associations' }),
  ).toBeVisible();
  await page.getByLabel('Outcome occurs').selectOption('1');
  await page.getByLabel('Perspective').selectOption('detrended');
  await expect(
    page.getByRole('heading', { name: 'Strongest observed associations' }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'All recorded dates' }).check();
  await expect(
    page.getByRole('heading', { name: 'Strongest observed associations' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/relationships.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: 'Multivariable model', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conditional associations' })).toBeVisible();
  await expect(page.getByText('Held-out MAE', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download model, design & validation' }).click();
  expect((await download).suggestedFilename()).toBe('teddmhen-multivariable-model.json');
  await page.getByLabel('Prediction timing').selectOption('7');
  await expect(page.getByRole('heading', { name: 'Conditional associations' })).toBeVisible();
  await page.getByText('Choose inputs', { exact: false }).click();
  await page.getByRole('button', { name: 'Select all inputs' }).click();
  await expect(page.getByText('Inputs not used', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'test-results/prediction-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page
    .getByRole('navigation', { name: 'Analysis views' })
    .getByRole('link', { name: 'Definitions & methods', exact: true })
    .click();
  await page.getByLabel('Find a definition').fill('HRV');
  await expect(page.getByRole('heading', { name: 'HRV ms', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('imports a previewed JSON file, skips existing dates and merges supplied fields without discarding notes', async ({
  page,
  request,
}) => {
  const date = '2000-06-08',
    entry = {
      ...emptyEntry(date),
      wellbeing: 8,
      notes: 'Preserve synthetic context',
      labels: ['travel'],
    };
  await page.goto('/import');
  const file = (object: unknown) => ({
    name: 'journal.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(object)),
  });
  await page.getByLabel('Journal export file').setInputFiles(file({ entries: [entry] }));
  await expect(page.getByRole('button', { name: 'Import reviewed observations' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Import reviewed observations' }).click();
  await expect(page.getByText('1 days saved · 0 skipped · 0 failed')).toBeVisible();
  expect(await (await request.get(`/api/entries/${date}`)).json()).toMatchObject({
    wellbeing: 8,
    labels: ['travel'],
  });
  await page
    .getByLabel('Journal export file')
    .setInputFiles(file({ entries: [{ date, wellbeing: 5 }] }));
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Import reviewed observations' }).click();
  await expect(page.getByText('0 days saved · 1 skipped · 0 failed')).toBeVisible();
  await page.getByRole('combobox', { name: /^Existing-day policy/ }).selectOption('merge');
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Import reviewed observations' }).click();
  await expect(page.getByText('1 days saved · 0 skipped · 0 failed')).toBeVisible();
  const saved = await (await request.get(`/api/entries/${date}`)).json();
  expect(saved).toMatchObject({
    wellbeing: 5,
    notes: 'Preserve synthetic context',
    labels: ['travel'],
    revision: 2,
  });
  await page
    .getByLabel('Journal export file')
    .setInputFiles(file({ entries: [{ date, wellbeing: 99 }] }));
  await expect(page.getByRole('alert')).toContainText('Observation 1');
  await expect(page.getByRole('button', { name: 'Import reviewed observations' })).toHaveCount(0);
  await request.delete(`/api/entries/${date}?revision=${saved.revision}`, {
    headers: { 'X-Teddmhen-Request': '1' },
  });
});

test('context labels persist and the public author page is available', async ({
  page,
  request,
}) => {
  const date = '2000-06-09';
  await page.goto(`/check-in?date=${date}`);
  await page.getByRole('checkbox', { name: 'Record context labels' }).check();
  await page.getByLabel('New context label').fill('Travel');
  await page.getByRole('button', { name: 'Add label', exact: true }).click();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved to your journal')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove label Travel' })).toBeVisible();
  const saved = await (await request.get(`/api/entries/${date}`)).json();
  await request.delete(`/api/entries/${date}?revision=${saved.revision}`, {
    headers: { 'X-Teddmhen-Request': '1' },
  });
  await page.goto('http://127.0.0.1:8789/about');
  await expect(page.getByRole('heading', { name: 'Piotr Żmuda.' })).toBeVisible();
  await expect(page.getByText(/powerlifting and long-distance running/)).toBeVisible();
});
