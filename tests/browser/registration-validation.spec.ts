import { test, expect } from '@playwright/test';
test.use({
  baseURL: 'http://127.0.0.1:8789',
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('mobile registration identifies short passwords and every invalid field instead of silently blocking submission', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route('**/api/auth/register', async (route) => {
    requests.push(route.request().method());
    await route.fulfill({
      status: 409,
      json: {
        error: 'This email cannot be registered. Try signing in or recovering your account.',
      },
    });
  });
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill('validation@example.test');
  await page.getByLabel('New password', { exact: true }).pressSequentially('short123');
  await page.getByLabel('Confirm password', { exact: true }).pressSequentially('short123');
  await page.getByRole('checkbox', { name: /I have read/ }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Password must contain at least 12 characters.',
  );
  await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('New password', { exact: true })).toBeFocused();
  await expect(page.getByLabel('New password', { exact: true })).toHaveAccessibleDescription(
    /4 more needed.*at least 12/,
  );
  expect(requests).toEqual([]);
  await page.screenshot({
    path: 'test-results/registration-short-password-mobile.png',
    fullPage: true,
  });
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription(
    'Enter a valid email address.',
  );
  await page.getByLabel('Email', { exact: true }).fill('another@example.test');
  await page.getByLabel('New password', { exact: true }).fill('long enough password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('Passwords do not match.');
  await page.getByLabel('Confirm password', { exact: true }).fill('long enough password');
  await page.getByRole('checkbox', { name: /I have read/ }).uncheck();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /I have read/ })).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('tick the acknowledgement');
  expect(requests).toEqual([]);
  await page.getByRole('checkbox', { name: /I have read/ }).check();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This email cannot be registered.');
  await expect(page.getByRole('alert').locator('..')).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('another@example.test');
  expect(requests).toEqual(['POST']);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.screenshot({
    path: 'test-results/registration-server-error-mobile.png',
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('recovery explains an incomplete code and valid login reports loading and server errors visibly', async ({
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
  const requests: string[] = [];
  await page.route('**/api/auth/*', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    started();
    await held;
    await route.fulfill({
      status: 429,
      json: { error: 'Too many attempts. Try again in 10 minutes.' },
    });
  });
  await page.goto('/recover');
  await page.getByLabel('Email', { exact: true }).fill('validation@example.test');
  await page.getByLabel('Recovery code', { exact: true }).fill('TMH-short');
  await page.getByLabel('New password', { exact: true }).fill('long enough password');
  await page.getByLabel('Confirm password', { exact: true }).fill('long enough password');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByLabel('Recovery code', { exact: true })).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('complete recovery code');
  expect(requests).toEqual([]);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('valid email');
  await page.getByLabel('Email', { exact: true }).fill('validation@example.test');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await arrived;
  await expect(page.getByRole('button', { name: 'Please wait…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Email', { exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('status')).toContainText('Keep this page open');
  release();
  await expect(page.getByRole('alert')).toContainText('Too many attempts.');
  await expect(page.getByRole('alert').locator('..')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  expect(requests).toEqual(['/api/auth/login']);
});
