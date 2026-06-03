/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { expect, test, type Download, type Locator, type Page } from '@playwright/test'
import JSZip from 'jszip'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const COIN_GREEN = '#238A5E'
const COIN_BG = '#2D3335'

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

/** Pull a single named entry out of a downloaded ZIP archive. */
async function extractZipEntry(zipBuffer: Buffer, name: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(zipBuffer)
  const entry = zip.file(name)
  if (!entry) throw new Error(`Zip is missing expected entry: ${name}`)
  return entry.async('nodebuffer')
}

/**
 * Flip the "Include background" switch to the desired state. Its underlying
 * checkbox is `pointer-events: none`, so the click target is the track div.
 */
async function setIncludeBackground(page: Page, on: boolean): Promise<void> {
  const row = page.locator('.ui-switch', { hasText: 'Include background' })
  const input = row.locator('input[type="checkbox"]')
  if ((await input.isChecked()) !== on) {
    await row.locator('.ui-switch__track').click()
  }
  await expect(input).toBeChecked({ checked: on })
}

/**
 * Decode a PNG inside the browser and report whether any pixel is fully
 * transparent (alpha 0). A backgroundless export leaves the padding/empty
 * cells transparent; an export with the background filled has none.
 */
async function pngHasTransparentPixels(page: Page, pngBuffer: Buffer): Promise<boolean> {
  return page.evaluate(async (base64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${base64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) return true
    }
    return false
  }, pngBuffer.toString('base64'))
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

    // The baseline was captured with the background filled, so enable it (the
    // toggle defaults to off / transparent).
    await setIncludeBackground(page, true)

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

  test('SVG export produces valid vector text', async ({ page }) => {
    // `numbers` is static, so the format select offers svg/png. SVG bytes embed
    // float metrics from live font measurement (not pixel-stable across runs),
    // so we assert structure rather than pixel-diffing.
    await page.goto('/?template=numbers')
    await waitForRender(page)

    await page
      .locator('.ui-select', { hasText: 'Format' })
      .locator('select')
      .selectOption('svg')

    const exportButton = page.getByRole('button', { name: 'Export Image' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])

    expect(download.suggestedFilename()).toBe('ascii-art.svg')

    const svg = (await downloadToBuffer(download)).toString('utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    // Default (non-flattened) export emits selectable <text>/<tspan> glyphs...
    expect(svg).toContain('<text')
    expect(svg).toContain('<tspan')
    // ...all in the stock text colour, since `numbers` sets no per-cell colour.
    expect(svg).toContain('fill="#d7d8d9"')
  })

  test('Copy SVG preserves per-cell colours', async ({ page, context }) => {
    // `coins` returns { char, color } per cell, so its SVG carries multiple
    // colour runs. The SVG format isn't offered for animated templates, but the
    // "Copy SVG" action works regardless and exercises the same generator.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/?template=coins')
    await waitForRender(page)

    await page.getByRole('button', { name: 'Copy SVG' }).click()

    // The copy runs through an async font/measurement step, so wait for the SVG
    // to actually land on the clipboard before reading it back.
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()), {
        timeout: 15_000,
      })
      .toContain('<svg')
    const svg = await page.evaluate(() => navigator.clipboard.readText())

    // Both coin colours present ⇒ per-cell colour runs survived into the SVG.
    expect(svg).toContain(`fill="${COIN_GREEN}"`)
    expect(svg).toContain(`fill="${COIN_BG}"`)
  })

  test('multi-colour frame export matches snapshot', async ({ page }) => {
    // Visual-diff the multi-colour raster path: `coins` exports a ZIP of PNG
    // frames, each rendered deterministically from the frame index (no time or
    // randomness), so frame 0 is reproducible. Pixel-diffing it guards the
    // per-cell colour rendering in renderBufferToCanvas.
    test.setTimeout(120_000)
    await page.goto('/?template=coins')
    await waitForRender(page)

    // The baseline was captured with the background filled, so enable it (the
    // toggle defaults to off / transparent).
    await setIncludeBackground(page, true)

    // Animated templates default the format to "PNGs" (frames) labelled
    // "Export Frames".
    const exportButton = page.getByRole('button', { name: 'Export Frames' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      exportButton.click(),
    ])

    expect(download.suggestedFilename()).toBe('ascii-animation-frames.zip')

    const zip = await downloadToBuffer(download)
    const frame = await extractZipEntry(zip, 'frame_0000.png')
    expect(frame.subarray(0, 8)).toEqual(PNG_MAGIC)
    expect(frame.length).toBeGreaterThan(1000)
    expect(frame).toMatchSnapshot('coins-frame-export.png')
  })

  // Pixel-diff the default (transparent) export for each deterministic example
  // template. `clock` renders the live wall-clock time and `unpkgDemo` seeds
  // simplex noise from Math.random, so neither is reproducible; `custom` is an
  // empty project. The rest render purely from the frame index, so frame 0 is
  // stable.
  const TRANSPARENT_EXAMPLES: { template: string; animated: boolean }[] = [
    { template: 'numbers', animated: false },
    { template: 'localPattern', animated: false },
    { template: 'sin', animated: true },
    { template: 'coins', animated: true },
    { template: 'imageCode', animated: true },
  ]

  for (const { template, animated } of TRANSPARENT_EXAMPLES) {
    test(`${template} exports a transparent PNG by default`, async ({ page }) => {
      // Animated templates capture every frame into a zip, which is slow.
      test.setTimeout(120_000)
      await page.goto(`/?template=${template}`)
      await waitForRender(page)

      // "Include background" defaults to off, so the export leaves the
      // padding/empty cells transparent rather than filling the canvas.
      const includeBackground = page
        .locator('.ui-switch', { hasText: 'Include background' })
        .locator('input[type="checkbox"]')
      await expect(includeBackground).not.toBeChecked()

      const exportButton = page.getByRole('button', {
        name: animated ? 'Export Frames' : 'Export Image',
      })
      await expect(exportButton).toBeEnabled()

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 120_000 }),
        exportButton.click(),
      ])

      // Static templates download a PNG directly; animated ones download a ZIP
      // whose first frame is the deterministic frame 0.
      const downloaded = await downloadToBuffer(download)
      const png = animated
        ? await extractZipEntry(downloaded, 'frame_0000.png')
        : downloaded

      expect(png.subarray(0, 8)).toEqual(PNG_MAGIC)
      expect(await pngHasTransparentPixels(page, png)).toBe(true)
      expect(png).toMatchSnapshot(`${template}-transparent.png`)
    })
  }

  test('PNG export is opaque when background is on', async ({ page }) => {
    await page.goto('/?template=numbers')
    await waitForRender(page)

    await setIncludeBackground(page, true)

    const exportButton = page.getByRole('button', { name: 'Export Image' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])

    const buffer = await downloadToBuffer(download)
    expect(buffer.subarray(0, 8)).toEqual(PNG_MAGIC)
    // The background fill covers every pixel, so nothing is left transparent.
    expect(await pngHasTransparentPixels(page, buffer)).toBe(false)
  })

  test('SVG export omits the background rect when background is off', async ({
    page,
  }) => {
    await page.goto('/?template=numbers')
    await waitForRender(page)

    await page
      .locator('.ui-select', { hasText: 'Format' })
      .locator('select')
      .selectOption('svg')

    const exportButton = page.getByRole('button', { name: 'Export Image' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])

    const svg = (await downloadToBuffer(download)).toString('utf-8')
    expect(svg).toContain('<svg')
    // No full-canvas background rect ⇒ transparent SVG.
    expect(svg).not.toContain('<rect')
  })

  test('SVG export includes the background rect when background is on', async ({
    page,
  }) => {
    // The "Include background" toggle only renders for the raster formats, so
    // set it while PNG is selected, then switch to SVG (the flag persists).
    await page.goto('/?template=numbers')
    await waitForRender(page)

    await setIncludeBackground(page, true)

    await page
      .locator('.ui-select', { hasText: 'Format' })
      .locator('select')
      .selectOption('svg')

    const exportButton = page.getByRole('button', { name: 'Export Image' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])

    const svg = (await downloadToBuffer(download)).toString('utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('<rect width="100%" height="100%"')
  })

  test('MP4 export keeps its background even when the toggle is off', async ({
    page,
  }) => {
    // Transparency isn't possible for video, so the "Include background" toggle
    // is disabled for MP4 and the format always renders an opaque frame.
    test.setTimeout(120_000)
    await page.goto('/?template=sin')
    await waitForRender(page)

    await page
      .locator('.ui-select', { hasText: 'Format' })
      .locator('select')
      .selectOption('mp4')

    const includeBackground = page
      .locator('.ui-switch', { hasText: 'Include background' })
      .locator('input[type="checkbox"]')
    await expect(includeBackground).not.toBeChecked()
    await expect(includeBackground).toBeDisabled()

    const exportButton = page.getByRole('button', { name: 'Export as MP4' })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      exportButton.click(),
    ])

    const buffer = await downloadToBuffer(download)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 16).includes(Buffer.from('ftyp'))).toBe(true)
  })
})
