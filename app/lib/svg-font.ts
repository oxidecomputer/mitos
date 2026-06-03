/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { parse, type Font } from 'opentype.js'

export type { Font }

// This is used to outline glyphs for SVG export
const FONT_URL = 'https://oxide.computer/fonts/GT-America-Mono-Regular-OCC.woff'

let fontPromise: Promise<Font> | null = null

/**
 * Fetch and parse the ASCII grid font, returning a parsed opentype Font that
 * can outline glyphs to SVG paths. The result is cached for the session; a
 * failed load is not cached so a later attempt can retry. Rejects if the font
 * cannot be fetched (e.g. CORS) or parsed.
 */
export function loadAsciiFont(): Promise<Font> {
  if (fontPromise) return fontPromise

  fontPromise = (async () => {
    const response = await fetch(FONT_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch font (${response.status})`)
    }
    const buffer = await response.arrayBuffer()
    return parse(buffer)
  })().catch((error) => {
    fontPromise = null // let the next caller retry
    throw error
  })

  return fontPromise
}

/**
 * Outline a run of text into a single SVG path `d` string, placing each glyph
 * on a fixed monospace grid so the outlines line up exactly with the cell
 * layout (rather than trusting the font's own advance width). `baselineY` is
 * the text baseline; `startX` is the left edge of the first cell.
 */
export function glyphRunToPathData(
  font: Font,
  text: string,
  startX: number,
  baselineY: number,
  fontSize: number,
  cellWidth: number,
): string {
  let d = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === ' ') continue // spaces have no outline
    const x = startX + i * cellWidth
    d += font.getPath(char, x, baselineY, fontSize).toPathData(2)
  }
  return d
}
