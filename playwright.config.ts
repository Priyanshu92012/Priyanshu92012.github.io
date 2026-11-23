import { defineConfig, devices } from '@playwright/test';

// E2E against the production build (`astro preview`). Uses the locally installed Chrome
// (no browser download). The live agent URL is always intercepted: tests never call the
// real Worker or a model provider.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    channel: process.env.PW_CHANNEL === 'bundled' ? undefined : 'chrome',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] }, // software WebGL so the 3D paths are exercised headless
  },
  webServer: {
    command: 'npx astro preview --port 4321',
    url: 'http://localhost:4321/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL === 'bundled' ? undefined : 'chrome', viewport: { width: 1440, height: 900 } } },
  ],
});
