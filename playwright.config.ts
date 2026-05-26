import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.BASE_URL ?? 'https://mail.711621.xyz/';
const authFile = '.auth/admin.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['./reporters/json-reporter.ts'],
    ['./reporters/live-log-reporter.ts'],
    ['./reporters/perf-reporter.ts'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: [/auth\/login\.spec\.ts/, /auth\.setup\.ts/],
    },
    {
      name: 'chromium-login',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\/login\.spec\.ts/,
    },
  ],
  outputDir: 'test-results',
});
