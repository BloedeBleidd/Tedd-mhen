import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:8789';
// Isolate these synthetic clients from the shared auth-throttling test's IP budget.
const headers = { Origin: origin, 'X-Teddmhen-Request': '1', 'CF-Connecting-IP': '192.0.2.77' };
const password = 'Synthetic personal layout 2026';

test('mobile account remembers layout and blank routines immediately across days and reloads, preserving recorded fields', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = page.context().request;
  expect(
    (
      await api.post(`${origin}/api/auth/register`, {
        headers,
        data: { email: `layout-${crypto.randomUUID()}@example.test`, password },
      })
    ).status(),
  ).toBe(200);
  try {
    await page.goto(`${origin}/check-in?date=2007-01-01`);
    await expect(page.getByRole('button', { name: 'Save check-in' })).toBeEnabled();
    await expect(page.locator('#sleep').getByLabel('HRV (ms)', { exact: true })).toBeVisible();
    await expect(page.locator('#body-signals')).toHaveCount(0);
    await page
      .locator('#daily-ratings')
      .getByRole('checkbox', { name: 'Wellbeing', exact: true })
      .check();
    await page
      .locator('#daily-ratings')
      .getByRole('slider', { name: 'Wellbeing', exact: true })
      .fill('8');
    await page.getByRole('button', { name: 'Customize my check-in' }).click();
    await page
      .locator('#checkin-personalization')
      .getByRole('checkbox', { name: 'Wellbeing', exact: true })
      .uncheck();
    await expect(
      page.locator('#daily-ratings').getByRole('slider', { name: 'Wellbeing', exact: true }),
    ).toHaveValue('8');
    await expect
      .poll(
        async () => (await (await api.get(`${origin}/api/preferences`)).json()).fields.wellbeing,
      )
      .toBe(false);
    expect((await api.get(`${origin}/api/entries/2007-01-01`)).status()).toBe(404);
    await page.getByRole('button', { name: 'Customize my check-in' }).click();
    await page
      .getByRole('combobox', { name: 'Measurement source', exact: true })
      .selectOption('polar');
    await page.getByRole('combobox', { name: 'HRV method', exact: true }).selectOption('rmssd');
    await page
      .locator('#habits')
      .getByRole('combobox', { name: 'Activity to track', exact: true })
      .selectOption('preset:reading_before_bed');
    await page
      .locator('#habits')
      .getByRole('button', { name: 'Track this activity today' })
      .click();
    await page.getByLabel('Daily count · Reading before bed', { exact: true }).fill('2');
    await page.getByText('Create your own activity & manage your library', { exact: true }).click();
    await page.getByLabel('Your activity name').fill('Żółć {{count}} — własny rytuał');
    await page.getByRole('button', { name: 'Create and track', exact: true }).click();
    await page
      .getByLabel('Daily count · Żółć {{count}} — własny rytuał', { exact: true })
      .fill('0');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByText('Saved to your journal')).toBeVisible();
    await page.getByLabel('Journal date', { exact: true }).fill('2007-01-02');
    await expect(
      page.locator('#daily-ratings').getByRole('checkbox', { name: 'Wellbeing', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel('Daily count · Reading before bed', { exact: true })).toHaveValue(
      '',
    );
    await expect(
      page.getByLabel('Daily count · Żółć {{count}} — własny rytuał', { exact: true }),
    ).toHaveValue('');
    await expect(
      page.getByRole('combobox', { name: 'Measurement source', exact: true }),
    ).toHaveValue('polar');
    await expect(page.getByRole('combobox', { name: 'HRV method', exact: true })).toHaveValue(
      'rmssd',
    );
    await page.reload();
    await expect(
      page.locator('#daily-ratings').getByRole('checkbox', { name: 'Wellbeing', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('.habit-editor')).toHaveCount(2);
    await page.getByRole('button', { name: 'Customize my check-in' }).click();
    await page
      .locator('#checkin-personalization')
      .getByRole('checkbox', { name: 'Wellbeing', exact: true })
      .check();
    await expect(
      page.locator('#daily-ratings').getByRole('checkbox', { name: 'Wellbeing', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Customize my check-in' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'test-results/personalized-checkin-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    const old = await (await api.get(`${origin}/api/entries/2007-01-01`)).json();
    expect(old.wellbeing).toBe(8);
    expect(old.habits.map((h: { count: number }) => h.count)).toEqual([2, 0]);
    expect((await api.get(`${origin}/api/entries/2007-01-02`)).status()).toBe(404);
  } finally {
    await api.post(`${origin}/api/auth/delete-account`, {
      headers,
      data: { currentPassword: password },
    });
  }
});

test('sport fields change dynamically without concealing existing distance or sets, and recent options lead', async ({
  page,
}) => {
  await page.goto(`${origin}/demo/check-in?date=2040-01-01`);
  await page.getByRole('button', { name: 'Add training session' }).click();
  const activity = page.getByRole('combobox', { name: 'Activity', exact: true });
  await activity.selectOption('strength');
  await expect(page.getByLabel('Distance (km)', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Exercise', { exact: true }).fill('Synthetic squat');
  await activity.selectOption('swimming');
  await expect(page.getByLabel('Distance (km)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Exercise', { exact: true })).toHaveValue('Synthetic squat');
  await page.getByLabel('Distance (km)', { exact: true }).fill('2');
  await activity.selectOption('yoga');
  await expect(page.getByLabel('Distance (km)', { exact: true })).toHaveValue('2');
  await page.getByLabel('Distance (km)', { exact: true }).fill('');
  await expect(page.getByLabel('Distance (km)', { exact: true })).toHaveCount(0);
  const recent = activity.locator('optgroup').first();
  await expect(recent).toHaveAttribute('label', 'Recently used');
  expect(
    await recent
      .locator('option')
      .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value)),
  ).toEqual(['yoga', 'swimming', 'strength']);
});

test('demo layout follows navigation, makes no live writes, and resets on reload', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) writes.push(r.url());
  });
  await page.goto(`${origin}/demo/check-in?date=2040-01-01`);
  await page.getByRole('button', { name: 'Customize my check-in' }).click();
  await page
    .locator('#checkin-personalization')
    .getByRole('checkbox', { name: 'Energy', exact: true })
    .uncheck();
  await page.getByRole('button', { name: 'Customize my check-in' }).click();
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await page.getByRole('link', { name: 'Daily check-in', exact: true }).click();
  await page.getByLabel('Journal date', { exact: true }).fill('2040-01-02');
  await expect(
    page.locator('#daily-ratings').getByRole('checkbox', { name: 'Energy', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator('#daily-ratings').getByRole('checkbox', { name: 'Energy', exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test('failed preference writes remain visible, retry in order, and cannot revert newer local choices', async ({
  page,
}) => {
  const api = page.context().request;
  await api.post(`${origin}/api/auth/register`, {
    headers,
    data: { email: `retry-${crypto.randomUUID()}@example.test`, password },
  });
  try {
    await page.goto(`${origin}/check-in?date=2007-02-01`);
    await expect(page.getByRole('button', { name: 'Save check-in' })).toBeEnabled();
    let blocked = true;
    await page.route('**/api/preferences', async (route) => {
      if (blocked && route.request().method() === 'PATCH')
        return route.fulfill({ status: 503, json: { error: 'Synthetic outage' } });
      await route.continue();
    });
    await page.getByRole('button', { name: 'Customize my check-in' }).click();
    const choices = page.locator('#checkin-personalization');
    await choices.getByRole('checkbox', { name: 'Energy', exact: true }).uncheck();
    await expect(page.getByRole('alert')).toContainText('could not be synchronized');
    await choices.getByRole('checkbox', { name: 'Energy', exact: true }).check();
    await choices.getByRole('checkbox', { name: 'Stress', exact: true }).uncheck();
    blocked = false;
    await page.getByRole('button', { name: 'Retry preferences' }).click();
    await expect(page.locator('.preferences-status')).toHaveCount(0);
    expect((await (await api.get(`${origin}/api/preferences`)).json()).fields).toMatchObject({
      energy: true,
      stress: false,
    });
    await page.reload();
    await expect(
      page.locator('#daily-ratings').getByRole('checkbox', { name: 'Energy', exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('#daily-ratings').getByRole('checkbox', { name: 'Stress', exact: true }),
    ).toHaveCount(0);
  } finally {
    await api.post(`${origin}/api/auth/delete-account`, {
      headers,
      data: { currentPassword: password },
    });
  }
});

test('definitions collapse the sports catalog, search expands matching categories and mathematics cites original work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/demo/analysis/metrics`);
  await expect(page.getByRole('heading', { name: 'Know what the numbers mean.' })).toBeVisible();
  await expect(page.locator('.definition-grid article:visible')).toHaveCount(0);
  await page.getByLabel('Find a definition').fill('Swimming');
  await expect(
    page.getByRole('heading', { name: 'Activity: Swimming 0 / 1', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Find a definition').fill('');
  await expect(page.locator('.definition-grid article:visible')).toHaveCount(0);
  await page.getByText('2. From prior to posterior', { exact: true }).click();
  await expect(page.locator('#mathematics .method-formula:visible')).toContainText('Vₙ');
  await expect(page.locator('#mathematics').getByRole('link', { name: /Murphy/ })).toHaveAttribute(
    'href',
    'https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf',
  );
  await page.getByText('4. Judge predictions on later observations', { exact: true }).click();
  await expect(page.getByText(/with observation 9 it scores 42/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'test-results/methods-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});
