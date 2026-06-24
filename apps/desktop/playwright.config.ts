import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E for @checkit/desktop.
 *
 * Strategy:
 * - Tests run against `next dev` on :3210 (started by the webServer block).
 * - We use the *system* Chrome (channel: 'chrome') instead of bundled chromium
 *   because chromium download times out on this machine.
 * - Each test seeds localStorage with a representative checkit report so we
 *   exercise the full dashboard render path without needing the Electron IPC.
 *
 * Why this matters:
 * - The renderer code is the same in dev (Next.js) and packaged (Electron).
 * - Headless server can't open Electron windows; this is the layer we CAN test.
 * - The IPC layer (Electron main + preload) gets exercised manually on a desktop.
 */

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,    // retry once on local too — dev server warmup flakes
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: {
    timeout: 10_000,                   // expect.* default 5s is too tight when next dev compiles on demand
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // No video — Playwright's bundled ffmpeg isn't available offline and
    // we don't need replay for these tests; screenshots on failure are enough.
    video: 'off',
    // Use the system Chrome — bundled chromium download times out on this host.
    channel: 'chrome',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'pnpm dev:next',
    url: BASE_URL,
    reuseExistingServer: true,  // reuse any :3000 server (prod or dev) — saves dev-mode compile wait
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});