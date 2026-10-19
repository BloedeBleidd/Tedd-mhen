import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const publicOrigin = 'http://127.0.0.1:8789';
const languages = ['en', 'pl', 'es', 'de', 'fr', 'pt'] as const;
const messages = (language: string, namespace: string) =>
  JSON.parse(
    fs.readFileSync(path.join('src/locales', language, namespace + '.json'), 'utf8'),
  ) as Record<string, string>;
async function choose(page: Page, language: string) {
  await page.locator('.language-trigger').click();
  await page.locator(`.language-dialog input[value="${language}"]`).check();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await page.keyboard.press('Escape');
}
for (const language of languages)
  test(`${language}: public demo and every major page remain discoverable on mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(publicOrigin + '/demo');
    await expect(page.locator('.recharts-surface').first()).toBeVisible();
    await choose(page, language);
    const pages = [
      ['/demo', 'dashboard', 'findYourRhythm'],
      ['/demo/journal', 'journal', ''],
      ['/demo/check-in', 'checkIn', ''],
      ['/demo/analysis', 'analysis', 'aPatternOrJustADay'],
      ['/demo/analysis/relationships', 'relationships', 'whatMovesTogether'],
      ['/demo/analysis/prediction', 'prediction', 'putYourObservationsTogether'],
      ['/demo/analysis/metrics', 'metricsGuide', 'knowWhatTheNumbersMean'],
      ['/demo/import', 'import', 'importJournalObservations'],
      ['/demo/export', 'export', 'takeTheFullPictureWithYou'],
      ['/demo/help', 'help', 'betterRecordsBetterQuestions'],
      ['/demo/privacy', 'privacy', 'yourJournalClearlyExplained'],
      ['/demo/about', 'about', ''],
    ];
    for (const [url, namespace, key] of pages) {
      await page.goto(publicOrigin + url);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.locator('main h1')).toBeVisible();
      if (key) await expect(page.locator('main h1')).toHaveText(messages(language, namespace)[key]);
      await expect(page.locator('main')).not.toContainText(
        /(?:activities|enums|validation|fields|measurements):[a-zA-Z_]/,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${language} ${url} overflow`,
      ).toBe(true);
    }
    await page.goto(publicOrigin + '/register');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await page.locator('button[type="submit"], .auth-form button.primary').click();
    await expect(page.locator('.field-error').first()).toHaveText(
      messages(language, 'common').enter_a_valid_email_address,
    );
  });

test('language changes preserve drafts and display canonical activities with original custom text', async ({
  page,
}) => {
  await page.goto(publicOrigin + '/demo/check-in?date=2000-01-01');
  await page.getByRole('button', { name: 'Add training session', exact: true }).click();
  await page.getByLabel('Activity', { exact: true }).selectOption('swimming');
  await page.getByLabel('Session title (optional)').fill('Swimming / Żółć');
  await page.getByText('Additional context', { exact: false }).click();
  await page.getByLabel('Daily notes', { exact: true }).fill('My Swimming note — moja notatka');
  await choose(page, 'pl');
  await expect(
    page.locator('select').filter({ has: page.locator('option[value="swimming"]') }),
  ).toHaveValue('swimming');
  await expect(page.locator('option[value="swimming"]')).toHaveText('Pływanie');
  await expect(page.locator('input[value="Swimming / Żółć"]')).toHaveValue('Swimming / Żółć');
  expect(
    await page
      .locator('textarea')
      .evaluateAll((elements) => elements.map((el) => (el as HTMLTextAreaElement).value)),
  ).toContain('My Swimming note — moja notatka');
  await page.locator('.activity-select input').fill('podwod');
  await expect(page.locator('option[value="underwater_hockey"]')).toHaveCount(1);
  await page.locator('.activity-select select').selectOption('underwater_hockey');
  await page.locator('.activity-select input').fill('');
  await choose(page, 'de');
  await expect(page.locator('.activity-select select')).toHaveValue('underwater_hockey');
  await page.locator('.activity-select select').selectOption('powerlifting');
  await expect(
    page.getByText(messages('de', 'checkIn').exercisesSets, { exact: true }),
  ).toBeVisible();
});

test('automatic defaults are English and light; device location is explicit and manual language wins', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 52.23, longitude: 21.01 });
  await page.goto(publicOrigin);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('teddmhen.appearance.v1'))).toBeNull();
  await page.locator('.language-trigger').click();
  await page.getByRole('button', { name: 'Use device location', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await page.locator('.language-dialog input[value="es"]').check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.locator('.language-forget').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.locator('.language-dialog input[value="auto"]').check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page.locator('.language-globe').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});

test('a failed language download retains the current language and can be retried', async ({
  page,
}) => {
  await page.goto(publicOrigin);
  await page.route('**/assets/pl-*.js', (route) => route.abort());
  await page.locator('.language-trigger').click();
  await page.locator('.language-dialog input[value="pl"]').check();
  await expect(page.getByRole('alert')).toContainText('Could not load this language');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.unroute('**/assets/pl-*.js');
  await page.getByRole('button', { name: 'Retry loading language' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});

test('a permission denial keeps Auto English/light and preserves manual choices', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_success: unknown, error: (cause: { code: number }) => void) =>
          error({ code: 1 }),
      },
    });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(publicOrigin);
  await page.locator('.language-trigger').click();
  await page.getByRole('button', { name: 'Use device location', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Location permission was not granted');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.language-dialog input[value="de"]').check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('demo loading keeps settings unavailable until their persistent controls are ready', async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/demo', async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto(publicOrigin + '/demo');
  await expect(page.locator('.language-trigger')).toBeDisabled();
  await expect(page.locator('.appearance-trigger')).toBeDisabled();
  release();
  await choose(page, 'pl');
  await expect(page.locator('main h1')).toHaveText(messages('pl', 'dashboard').findYourRhythm);
});

test('unavailable page code shows a localized recovery screen without exposing a stack trace', async ({
  page,
}) => {
  await page.goto(publicOrigin + '/demo');
  await choose(page, 'pl');
  await page.route('**/assets/DataTransfer-*.js', (route) => route.abort());
  await page.locator('a[href="/demo/export"]').first().click();
  await expect(page.getByRole('heading', { name: messages('pl', 'app').pageFailed })).toBeVisible();
  await expect(page.getByRole('button', { name: messages('pl', 'app').reload })).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText(
    /TypeError|Failed to fetch dynamically|Unexpected Application Error/,
  );
});
