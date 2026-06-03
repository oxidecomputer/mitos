/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { expect, test, type Download, type Locator, type Page } from '@playwright/test'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * Wait until the ASCII canvas has actually painted. The renderer sets the
 * canvas `width`/`height` attributes on its first render, so a non-zero width
 * is a reliable signal that the compiled program has run and drawn a frame.
 */
async function waitForRender(page: Page): Promise<Locator> {
  const canvas = page.locator('#ascii-canvas')
  await expect(canvas).toBeVisible()
  // Webfont drives the canvas text metrics; wait for it so cell sizing is stable.
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(() => canvas.evaluate((c) => (c as HTMLCanvasElement).width), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)
  // Let any font-swap repaint settle before capturing.
  await page.waitForTimeout(300)
  return canvas
}

/**
 * Read the canvas's own bitmap as a PNG buffer. Going through `toDataURL`
 * (rather than a page screenshot) captures only the rendered pixels, with no
 * surrounding/overlapping UI compositing into the frame.
 */
async function canvasToPngBuffer(canvas: Locator): Promise<Buffer> {
  const dataUrl = await canvas.evaluate((c) =>
    (c as HTMLCanvasElement).toDataURL('image/png'),
  )
  return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
}

/** Collect a Playwright download into a single Buffer. */
async function downloadToBuffer(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

test.describe('ascii render snapshots', () => {
  test('static template renders deterministically to canvas', async ({ page }) => {
    // `numbers` has animationLength 1 — fully static, no time/frame dependence.
    await page.goto('/?template=numbers')
    const canvas = await waitForRender(page)

    const buffer = await canvasToPngBuffer(canvas)
    expect(buffer.subarray(0, 8)).toEqual(PNG_MAGIC)
    expect(buffer).toMatchSnapshot('numbers-canvas.png')
  })

  test('PNG export matches snapshot', async ({ page }) => {
    await page.goto('/?template=numbers')
    await waitForRender(page)

    // Static templates default the export format to PNG and label the button
    // "Export Image".
    const exportButton = page.getByRole('button', { name: 'Export Image' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])

    expect(download.suggestedFilename()).toBe('ascii-art.png')

    const buffer = await downloadToBuffer(download)
    // Sanity: it's a real, non-trivial PNG before we pixel-diff it.
    expect(buffer.subarray(0, 8)).toEqual(PNG_MAGIC)
    expect(buffer.length).toBeGreaterThan(1000)

    // Pixel-diff the exported image against the committed baseline.
    expect(buffer).toMatchSnapshot('numbers-export.png')
  })

  test('MP4 export produces a valid video file', async ({ page }) => {
    // Video bytes are not deterministic across encoder versions, so we assert a
    // well-formed, non-empty MP4 is produced rather than pixel-diffing frames.
    // `sin` is animated (animationLength > 1), which enables the MP4 format.
    await page.goto('/?template=sin')
    await waitForRender(page)

    await page
      .locator('.ui-select', { hasText: 'Format' })
      .locator('select')
      .selectOption('mp4')

    const exportButton = page.getByRole('button', { name: 'Export as MP4' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      exportButton.click(),
    ])

    expect(download.suggestedFilename()).toMatch(/\.mp4$/)

    const buffer = await downloadToBuffer(download)
    expect(buffer.length).toBeGreaterThan(1000)
    // MP4/ISO-BMFF files carry an 'ftyp' box marker near the start.
    expect(buffer.subarray(0, 16).includes(Buffer.from('ftyp'))).toBe(true)
  })
})
