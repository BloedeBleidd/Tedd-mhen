import { test, expect, type Page } from '@playwright/test';

type MotionWindow = Window & { reveals: { element: Element; animation: Animation }[] };
async function observeMotion(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as MotionWindow).reveals = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
      const animation = animate.apply(this, args);
      (window as unknown as MotionWindow).reveals.push({ element: this, animation });
      return animation;
    };
  });
}
async function demo(page: Page) {
  await page.goto('http://127.0.0.1:8789/demo');
  await expect(page.getByRole('heading', { name: 'Your days, in perspective' })).toBeVisible();
}
const revealCount = (page: Page, selector: string) =>
  page.evaluate(
    (selector) =>
      (window as unknown as MotionWindow).reveals.filter(({ element }) => element.matches(selector))
        .length,
    selector,
  );

test('Bayesian bands and lines reveal fixed geometry; reduced motion cancels a running animation', async ({
  page,
}) => {
  await observeMotion(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await demo(page);
  await page.getByRole('link', { name: 'Trends & predictions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wellbeing, with perspective' })).toBeVisible();
  const chart = page.locator('.chart').first();
  await chart.scrollIntoViewIfNeeded();
  await expect.poll(() => revealCount(page, '.chart-band')).toBe(2);
  const geometry = await page.evaluate(() => {
    const records = (window as unknown as MotionWindow).reveals.filter(
      ({ element }) => element.isConnected && element.matches('.chart-series'),
    );
    for (const { animation } of records) {
      animation.pause();
      animation.currentTime = 80;
    }
    return [...document.querySelectorAll('.chart-series path')].map((path) =>
      path.getAttribute('d'),
    );
  });
  expect(geometry.length).toBeGreaterThan(2);
  await chart.screenshot({ path: 'test-results/motion-chart-mid.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as MotionWindow).reveals
          .filter(({ element }) => element.isConnected)
          .every(({ animation }) => animation.playState === 'idle'),
      ),
    )
    .toBe(true);
  expect(
    await page
      .locator('.chart-series path')
      .evaluateAll((paths) => paths.map((path) => path.getAttribute('d'))),
  ).toEqual(geometry);
  await expect(chart).toBeVisible();
  await chart.screenshot({ path: 'test-results/motion-chart-final.png' });
  expect(
    await page.locator('.page-heading').evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('none');
});

test('correlation points and scrolled panels animate once, and new settings reveal the new result', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeMotion(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await demo(page);
  await page.getByRole('link', { name: 'Trends & predictions', exact: true }).click();
  await page.getByRole('link', { name: 'Relationships', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Strongest observed associations' }),
  ).toBeVisible();
  const chart = page.locator('.chart').first();
  await chart.scrollIntoViewIfNeeded();
  await expect.poll(() => revealCount(page, '.recharts-scatter.chart-points')).toBe(1);
  const report = page
    .locator('section.panel')
    .filter({ has: page.getByRole('heading', { name: 'Reproduce this result' }) });
  expect(await report.evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThan(800);
  const panelCount = () =>
    report.evaluate(
      (node) =>
        (window as unknown as MotionWindow).reveals.filter(({ element }) => element === node)
          .length,
    );
  expect(await panelCount()).toBe(0);
  await report.scrollIntoViewIfNeeded();
  await expect.poll(panelCount).toBe(1);
  await chart.scrollIntoViewIfNeeded();
  await report.scrollIntoViewIfNeeded();
  expect(await panelCount()).toBe(1);
  await page.getByLabel('Outcome occurs').selectOption('1');
  await expect(
    page.getByRole('heading', { name: 'Strongest observed associations' }),
  ).toBeVisible();
  await page.locator('.chart').first().scrollIntoViewIfNeeded();
  await expect.poll(() => revealCount(page, '.recharts-scatter.chart-points')).toBe(2);
  const frames = await page.evaluate(() =>
    (
      (window as unknown as MotionWindow).reveals.find(({ element }) =>
        element.matches('.recharts-scatter.chart-points'),
      )!.animation.effect as KeyframeEffect
    ).getKeyframes(),
  );
  expect(frames.map((frame) => frame.opacity)).toEqual(['0', '1']);
  expect(frames.every((frame) => !('transform' in frame))).toBe(true);
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page.getByRole('dialog').evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('surface-enter');
  await page.getByRole('button', { name: 'Close appearance' }).click();
  expect(errors).toEqual([]);
});

test('a reduced-motion preference applies from the first render, including charts and notices', async ({
  page,
}) => {
  await observeMotion(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await demo(page);
  await page.getByRole('link', { name: 'Trends & predictions', exact: true }).click();
  await page.getByRole('link', { name: 'Multivariable model', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conditional associations' })).toBeVisible();
  await page.locator('.chart').first().scrollIntoViewIfNeeded();
  expect(await revealCount(page, '*')).toBe(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.screenshot({ path: 'test-results/motion-reduced.png', fullPage: true });
});

test('charts and forms remain available without browser animation or intersection APIs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined });
    Object.defineProperty(Element.prototype, 'animate', { value: undefined });
  });
  await demo(page);
  await expect(page.locator('.recharts-line-curve')).toBeVisible();
  await page.getByRole('link', { name: 'Daily check-in', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Save check-in' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('focusing a control during a panel reveal keeps its click target stationary', async ({
  page,
}) => {
  await observeMotion(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await demo(page);
  const link = page.getByRole('link', { name: 'Explore Bayesian trends', exact: true });
  await link.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as MotionWindow).reveals.filter(({ element }) =>
            element.contains(document.querySelector('.chart-footer a')),
          ).length,
      ),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    for (const { element, animation } of (window as unknown as MotionWindow).reveals) {
      if (element.contains(document.querySelector('.chart-footer a'))) {
        animation.pause();
        animation.currentTime = 1;
      }
    }
  });
  const before = await link.boundingBox();
  await link.focus();
  expect(await link.boundingBox()).toEqual(before);
  await link.click();
  await expect(page.getByRole('heading', { name: 'Wellbeing, with perspective' })).toBeVisible();
});
