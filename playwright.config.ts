import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const testTimeout = Number(process.env.PLAYWRIGHT_TEST_TIMEOUT ?? '60000');
const expectTimeout = Number(process.env.PLAYWRIGHT_EXPECT_TIMEOUT ?? '10000');
const actionTimeout = Number(process.env.PLAYWRIGHT_ACTION_TIMEOUT ?? '15000');
const navigationTimeout = Number(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT ?? '30000');
const baseURL = process.env.PLAYWRIGHT_UI_BASE_URL ?? 'http://127.0.0.1:4173';
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
  'pnpm --filter ui-client exec vite dev --host 127.0.0.1 --port 4173';
const webServerTimeout = Number(process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT ?? '180000');

export default defineConfig({
  testDir: 'apps/ui-client/e2e',
  timeout: testTimeout,
  expect: {
    timeout: expectTimeout,
  },
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    actionTimeout,
    navigationTimeout,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !isCI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: webServerTimeout,
  },
});
