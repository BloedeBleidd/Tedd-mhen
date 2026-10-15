import { test, expect } from '@playwright/test';

test('mobile analyses expose compact navigation, resizable charts and long-horizon evaluation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8789/demo/analysis');
  await expect(page.getByRole('heading', { name: 'Wellbeing, with perspective' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Analysis views' });
  expect((await navigation.boundingBox())!.height).toBeLessThan(205);
  await expect(navigation.getByRole('link')).toHaveCount(4);
  await page.getByLabel('Forecast horizon').selectOption('28');
  await expect(page.getByText(/28-day extrapolation/)).toBeVisible();
  await expect(page.getByText(/14–28 days is an exploratory horizon/)).toBeVisible();
  const chart = page.locator('.chart').first();
  await page.getByLabel('Chart size').selectOption('compact');
  await expect.poll(async () => (await chart.boundingBox())!.height).toBe(220);
  await page.getByLabel('Chart size').selectOption('large');
  await expect.poll(async () => (await chart.boundingBox())!.height).toBe(480);
  await expect(page.getByRole('link', { name: /Murphy, K. P. \(2007\)/ })).toHaveAttribute(
    'href',
    /bayesGauss.pdf/,
  );
  await navigation.getByRole('link', { name: 'Multivariable model', exact: true }).click();
  await page.getByLabel('Prediction timing').selectOption('28');
  await expect(
    page.getByText('95% interval score · lower is better', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Predictions compared with held-out observations and 95% predictive intervals',
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Gneiting, T. & Raftery/ })).toHaveAttribute(
    'href',
    'https://doi.org/10.1198/016214506000001437',
  );
  await page.getByRole('link', { name: 'View results ↓' }).click();
  await expect(page.locator('#analysis-results')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const comparison = page.locator('.analysis-chart-grid > .panel');
  const fitBox = (await comparison.nth(0).boundingBox())!;
  const holdoutBox = (await comparison.nth(1).boundingBox())!;
  expect(Math.abs(fitBox.y - holdoutBox.y)).toBeLessThan(2);
  expect(holdoutBox.x).toBeGreaterThan(fitBox.x + fitBox.width);
});

test('Polish correlation and prediction intervals keep spaces between their bounds', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('teddmhen.language.v1', 'pl'));
  await page.goto('http://127.0.0.1:8789/demo/analysis/relationships');
  const interval = page.locator('.analysis-stats > div').nth(1).locator('strong');
  await expect(interval).toContainText(/\d,\d+ – -?\d/);
  await expect(page.locator('main')).not.toContainText(/\d(?:do|to)\d/);
  await page.goto('http://127.0.0.1:8789/demo/analysis/prediction');
  await expect(page.locator('.evaluation-metrics')).toBeVisible();
  await expect(page.locator('.forecast-result')).toContainText(/\d,\d+ – -?\d/);
  await expect(page.locator('main')).not.toContainText(/\d(?:do|to)\d/);
});
