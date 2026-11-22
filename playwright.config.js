import { defineConfig, devices } from '@playwright/test';

// Set PLAYWRIGHT_BASE_URL to test a deployed Site instead of the local checkout.
const deployedURL = process.env.PLAYWRIGHT_BASE_URL;
const localURL = 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: deployedURL || localURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: deployedURL ? undefined : {
    command: 'npm run dev',
    url: localURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
