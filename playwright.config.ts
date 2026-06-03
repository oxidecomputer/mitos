/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const baseURL = `http://localhost:${PORT}`

/**
 * Playwright drives the real app in a browser to take render snapshots of the
 * ASCII canvas and exported assets. These tests live in `e2e/` and are run with
 * `bun run test:e2e` — separately from the `bun test` unit suite in `tests/`.
 *
 * Snapshot baselines are platform-specific (font rasterization differs across
 * OSes), so they are stored with an OS suffix. Regenerate with
 * `bun run test:e2e:update` on the same platform that runs CI.
 */
export default defineConfig({
  testDir: './e2e',
  // Snapshots are inherently sensitive to timing/animation; never silently retry
  // into a green by chance. Fail fast and let the author inspect the diff.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  expect: {
    toHaveScreenshot: {
      // Allow a little slack for subpixel font rendering while still catching
      // real layout/content regressions.
      maxDiffPixelRatio: 0.01,
      // Anti-aliasing tolerance per pixel.
      threshold: 0.2,
    },
  },

  use: {
    baseURL,
    // Pin the device scale factor so the supersampled canvas screenshots are
    // reproducible regardless of the host display.
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
    },
  ],

  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
