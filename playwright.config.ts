import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8788', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: process.env.TEDDMHEN_RELEASE
        ? 'node scripts/e2e-server.mjs'
        : 'npm run build && node scripts/e2e-server.mjs',
      url: 'http://127.0.0.1:8788/api/health',
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/e2e-server.mjs --accounts',
      url: 'http://127.0.0.1:8789/api/health',
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
