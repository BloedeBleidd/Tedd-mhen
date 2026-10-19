import { test, expect } from '@playwright/test';
test('daily check-in persists, edits, exports selected fields, and deletes', async ({
  page,
  request,
}) => {
  const date = '2001-02-03';
  const old = await request.get(`/api/entries/${date}`);
  if (old.ok())
    await request.delete(`/api/entries/${date}?revision=${(await old.json()).revision}`, {
      headers: { 'X-Teddmhen-Request': '1' },
    });
  await page.goto(`/check-in?date=${date}`);
  await expect(page.getByRole('heading', { name: 'How was your day?' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Wellbeing', exact: true }).check();
  await page.getByRole('slider', { name: 'Wellbeing', exact: true }).fill('8');
  await page.getByLabel('Actual sleep (minutes)').fill('450');
  await page.getByLabel('Training status').selectOption('rest');
  await page.getByText('Additional context', { exact: false }).click();
  await page.getByLabel('Daily notes').fill('Synthetic browser-test record.');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved to your journal')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Wellbeing', exact: true })).toHaveValue('8');
  await expect(page.getByLabel('Actual sleep (minutes)')).toHaveValue('450');
  await page.getByRole('slider', { name: 'Wellbeing', exact: true }).fill('7');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Saved to your journal')).toBeVisible();
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill('Synthetic browser-test');
  await expect(page.getByRole('link', { name: /3 Feb 2001/ })).toBeVisible();
  const exported = await request.get(
    `/api/export?from=${date}&to=${date}&format=json&groups=ratings&fields=wellbeing`,
  );
  const body = await exported.json();
  expect(body.entries).toHaveLength(1);
  expect(body.entries[0].wellbeing).toBe(7);
  expect(body.entries[0].notes).toBeUndefined();
  await page.getByRole('link', { name: /3 Feb 2001/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Your entry is not saved yet')).toBeVisible();
  expect((await request.get(`/api/entries/${date}`)).status()).toBe(404);
});
test('demo charts, settings, export, mobile navigation and no runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8789/demo');
  await expect(page.getByText('DEMO DATA', { exact: true })).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/overview-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Trends & predictions', exact: true }).click();
  await expect(page.getByText('Probability of an increasing trend')).toBeVisible();
  await page.getByLabel('What would you like to understand?').selectOption('hrv');
  await page.getByText(/^Model settings & data selection/).click();
  await page.getByLabel('HRV method').selectOption('rmssd');
  await page.getByLabel('Prior on the weekly slope').selectOption('strong');
  await expect(page.getByLabel('HRV method')).toHaveValue('rmssd');
  await page.screenshot({ path: 'test-results/analysis-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Export & import', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download export' }).click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toMatch(/^teddmhen-.*\.json$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible();
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  await page.screenshot({
    path: 'test-results/overview-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
test('unsaved edits are protected when navigating', async ({ page }) => {
  await page.goto('/check-in?date=2001-02-04');
  await page.getByRole('checkbox', { name: 'Energy', exact: true }).check();
  let handled = new Promise<void>((resolve) =>
    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
      resolve();
    }),
  );
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await handled;
  await expect(page.getByRole('heading', { name: 'How was your day?' })).toBeVisible();
  handled = new Promise<void>((resolve) =>
    page.once('dialog', async (dialog) => {
      await dialog.accept();
      resolve();
    }),
  );
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await handled;
  await expect(page.getByRole('heading', { name: 'Every day tells a story.' })).toBeVisible();
});
