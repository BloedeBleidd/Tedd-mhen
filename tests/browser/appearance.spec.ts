import { test, expect } from '@playwright/test';
import { getTimes } from 'suncalc';

test('themes persist, privacy notice is dismissible, and dark pages fit mobile', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('http://127.0.0.1:8789/demo');
  await expect(page.getByRole('complementary', { name: 'Cookies and data notice' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Close appearance' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('complementary', { name: 'Cookies and data notice' })).toHaveCount(0);
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/overview-dark.png', fullPage: true });
  await page.getByRole('link', { name: 'Privacy & data', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Cookies and browser storage' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'test-results/appearance-mobile-dark.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('location is opt-in and Auto switches at sunset without reloading', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => localStorage.setItem('teddmhen.language.v1', 'en'));
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 52.23, longitude: 21.01 });
  const sunset = getTimes(new Date('2026-06-21T12:00:00Z'), 52.23, 21.01).sunset!;
  await page.clock.install({ time: new Date(sunset.getTime() - 20000) });
  await page.clock.pauseAt(new Date(sunset.getTime() - 10000));
  await page.goto('/');
  expect(await page.evaluate(() => localStorage.getItem('teddmhen.appearance.v1'))).toBeNull();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Use device location' }).click();
  await expect(page.getByText(/Dark at sunset/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.clock.runFor(11000);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText(/Light at sunrise/)).toBeVisible();
  await page.getByRole('button', { name: 'Forget saved location' }).click();
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('teddmhen.appearance.v1')))!)
      .location,
  ).toBeNull();
});

test('denied location and unavailable storage remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_ok: unknown, error: (error: { code: number }) => void) =>
          error({ code: 1 }),
      },
    });
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Use device location' }).click();
  await expect(page.getByRole('alert')).toContainText('Location permission was not granted');
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible();
});
