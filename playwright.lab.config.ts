import { defineConfig, devices } from '@playwright/test';

// V3 design-lab suite, against the LAB build (`npm run lab:build`), served on :4330.
// Kept separate from the production e2e suite so V2's tests and dist/ stay untouched.
export default defineConfig({
  testDir: 'tests/lab',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4330',
    channel: process.env.PW_CHANNEL === 'bundled' ? undefined : 'chrome',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npx astro preview --config astro.lab.config.mjs --ignore-lock',
    url: 'http://127.0.0.1:4330/design-lab/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL === 'bundled' ? undefined : 'chrome', viewport: { width: 1440, height: 900 } } }],
});
