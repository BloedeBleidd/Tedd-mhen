import { test, expect } from '@playwright/test';
import { emptyEntry, shiftDate } from '../../shared/schema';

const custom = 'Oddychanie {{count}} <mój rytuał>';
test('mobile custom activities save, reuse, archive and export without changing user text', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const date = '2008-01-01';
  await page.goto(`/check-in?date=${date}`);
  await page.getByRole('link', { name: 'Habits & activities', exact: true }).click();
  await page.getByText('Create your own activity & manage your library', { exact: true }).click();
  await page.getByLabel('Your activity name').fill(custom);
  await page.getByRole('button', { name: 'Create and track', exact: true }).click();
  const editor = page.locator('.habit-editor');
  await expect(editor.getByRole('heading', { name: custom, exact: true })).toBeVisible();
  await editor.getByRole('spinbutton', { name: `Daily count · ${custom}`, exact: true }).fill('2');
  await editor.getByLabel('Total minutes (optional)').fill('15');
  await editor.getByRole('button', { name: 'Add event time' }).click();
  await editor.getByLabel('Event 1 time', { exact: true }).fill('09:15');
  await editor.getByRole('button', { name: 'Add event time' }).click();
  await editor.getByLabel('Event 2 time', { exact: true }).fill('21:30');
  await editor.getByText('Activity notes (optional)', { exact: true }).click();
  await editor
    .getByLabel(`Notes · ${custom}`, { exact: true })
    .fill('Żółć, oryginalna notatka {{count}}');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved to your journal')).toBeVisible();
  await page
    .locator('#habits')
    .screenshot({ path: 'test-results/habits-mobile.png', animations: 'disabled' });
  const saved = await (await request.get(`/api/entries/${date}`)).json();
  expect(saved.habits).toHaveLength(1);
  expect(saved.habits[0]).toMatchObject({
    name: custom,
    count: 2,
    times: ['09:15', '21:30'],
    durationMinutes: 15,
  });
  expect(saved.habits[0]).not.toHaveProperty('archived');
  await page.reload();
  await expect(editor.getByLabel('Event 2 time', { exact: true })).toHaveValue('21:30');
  await page.goto('/check-in?date=2008-01-02');
  await page
    .getByRole('combobox', { name: 'Activity to track', exact: true })
    .selectOption(saved.habits[0].key);
  await page.getByRole('button', { name: 'Track this activity today' }).click();
  await editor.getByRole('spinbutton', { name: `Daily count · ${custom}`, exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved to your journal')).toBeVisible();
  await page.getByText('Create your own activity & manage your library', { exact: true }).click();
  await page.getByText('Manage custom activities', { exact: true }).click();
  await page
    .locator('.habit-library-row')
    .filter({ hasText: custom })
    .getByRole('button', { name: 'Archive', exact: true })
    .click();
  await expect(
    page
      .locator('.habit-library-row')
      .filter({ hasText: custom })
      .getByRole('button', { name: 'Restore' }),
  ).toBeVisible();
  await page.goto('/journal');
  await page
    .getByRole('combobox', { name: 'Recorded habit', exact: true })
    .selectOption(saved.habits[0].key);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const full = await (await request.get('/api/export?from=2008-01-01&to=2008-01-02')).json();
  expect(full.entries[0].habits[0].notes).toBe('Żółć, oryginalna notatka {{count}}');
  expect(full.entries[1].habits[0].count).toBe(0);
  for (const row of full.entries)
    await request.delete(`/api/entries/${row.date}?revision=${row.revision}`, {
      headers: { 'X-Teddmhen-Request': '1' },
    });
});

test('public demo includes habits, custom library and browser-only experimentation', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (['PUT', 'POST', 'DELETE'].includes(r.method())) writes.push(r.url());
  });
  await page.goto('http://127.0.0.1:8789/demo/journal');
  await page
    .getByRole('combobox', { name: 'Recorded habit', exact: true })
    .selectOption('preset:nail_biting');
  await expect(page.locator('tbody tr').first()).toContainText('View all activities');
  await page.locator('tbody tr').first().getByRole('link', { name: 'View all activities' }).click();
  await expect(page.locator('#habits h2')).toBeInViewport();
  await expect(
    page
      .locator('.habit-editor')
      .filter({ has: page.getByRole('heading', { name: 'Nail biting', exact: true }) }),
  ).toBeVisible();
  await page.getByText('Create your own activity & manage your library', { exact: true }).click();
  await page.getByLabel('Your activity name').fill('Demo-only ritual');
  await page.getByRole('button', { name: 'Create and track', exact: true }).click();
  await page
    .getByRole('spinbutton', { name: 'Daily count · Demo-only ritual', exact: true })
    .fill('1');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  const acknowledge = page.getByRole('checkbox', {
    name: 'I checked these observations and want to keep the values as entered.',
  });
  if (await acknowledge.isVisible()) {
    await acknowledge.check();
    await page.getByRole('button', { name: 'Save check-in' }).click();
  }
  await expect(page.getByText('Saved in demo memory')).toBeVisible();
  expect(writes).toEqual([]);
});

test('contradictory observations require review, edits invalidate acknowledgement and confirmed values are retained', async ({
  page,
  request,
}) => {
  const date = '2009-04-01';
  for (let i = 0; i < 40; i++) {
    const day = shiftDate(date, i - 40),
      stress = 1 + ((i * 7) % 9);
    const e = {
      ...emptyEntry(day),
      stress,
      sleep: { ...emptyEntry(day).sleep, durationMinutes: Math.round((10 - stress * 0.6) * 60) },
    };
    expect(
      (
        await request.put(`/api/entries/${day}`, {
          headers: { 'X-Teddmhen-Request': '1' },
          data: { entry: e, revision: 0 },
        })
      ).ok(),
    ).toBe(true);
  }
  await page.goto(`/check-in?date=${date}`);
  await page.getByRole('checkbox', { name: 'Stress', exact: true }).check();
  await page.getByRole('slider', { name: 'Stress', exact: true }).fill('8');
  await page.getByLabel('Actual sleep (minutes)').fill('540');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.locator('#checkin-review')).toContainText('99.5% prediction interval');
  expect((await request.get(`/api/entries/${date}`)).status()).toBe(404);
  const ack = page.getByRole('checkbox', {
    name: 'I checked these observations and want to keep the values as entered.',
  });
  await ack.check();
  await page.getByLabel('Actual sleep (minutes)').fill('550');
  await expect(ack).not.toBeChecked();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  expect((await request.get(`/api/entries/${date}`)).status()).toBe(404);
  await ack.check();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved to your journal')).toBeVisible();
  expect(await (await request.get(`/api/entries/${date}`)).json()).toMatchObject({
    stress: 8,
    sleep: { durationMinutes: 550 },
  });
  for (let i = -40; i <= 0; i++)
    await request.delete(`/api/entries/${shiftDate(date, i)}?revision=1`, {
      headers: { 'X-Teddmhen-Request': '1' },
    });
});

test('a delayed custom category preserves intervening edits and cannot attach itself to another day', async ({
  page,
  request,
}) => {
  const date = '2010-02-01';
  await page.goto(`/check-in?date=${date}`);
  await page
    .getByRole('combobox', { name: 'Activity to track', exact: true })
    .selectOption('preset:reading_before_bed');
  await page.getByRole('button', { name: 'Track this activity today' }).click();
  const count = page.getByRole('spinbutton', {
    name: 'Daily count · Reading before bed',
    exact: true,
  });
  await count.fill('1');
  let release!: () => void;
  let held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/habit-definitions', async (route) => {
    if (route.request().method() === 'PUT') await held;
    await route.continue();
  });
  await page.getByText('Create your own activity & manage your library', { exact: true }).click();
  await page.getByLabel('Your activity name').fill('Delayed ritual');
  await page.getByRole('button', { name: 'Create and track', exact: true }).click();
  await count.fill('4');
  release();
  await expect(
    page.locator('.habit-editor').getByRole('heading', { name: 'Delayed ritual', exact: true }),
  ).toBeVisible();
  await expect(count).toHaveValue('4');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved to your journal')).toBeVisible();
  held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.getByLabel('Your activity name').fill('Created while switching day');
  await page.getByRole('button', { name: 'Create and track', exact: true }).click();
  await page.getByLabel('Journal date', { exact: true }).fill('2010-02-02');
  await expect(page.getByRole('button', { name: 'Save check-in' })).toBeEnabled();
  await expect(page.locator('.habit-editor')).toHaveCount(0);
  release();
  await expect
    .poll(async () =>
      (await (await request.get('/api/habit-definitions')).json()).definitions.some(
        (d: { name: string }) => d.name === 'Created while switching day',
      ),
    )
    .toBe(true);
  await expect(page.locator('.habit-editor')).toHaveCount(0);
  expect((await request.get('/api/entries/2010-02-02')).status()).toBe(404);
  await request.delete(`/api/entries/${date}?revision=1`, {
    headers: { 'X-Teddmhen-Request': '1' },
  });
});
