/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import type { Cell } from './animation'

/**
 * Anything that can hand back the current cell buffer. Kept structural (rather
 * than importing the full AnimationController) so this module stays free of DOM
 * dependencies and can be unit tested in isolation.
 */
export interface BufferSource {
  getBuffer: () => Cell[]
}

/**
 * Format the flat cell buffer into newline-separated text laid out as a
 * `width` × `height` grid. Empty cells render as a single space, so every line
 * is exactly `width` characters wide (including trailing spaces).
 */
export const getContent = (
  dimensions: { width: number; height: number },
  source: BufferSource | null,
): string => {
  if (!source) return ''

  const buffer = source.getBuffer()
  const { width, height } = dimensions
  const formattedLines = []

  for (let i = 0; i < height; i++) {
    const lineStart = i * width
    const lineEnd = lineStart + width
    const lineCells = buffer.slice(lineStart, lineEnd)
    const line = lineCells.map((cell) => cell.char || ' ').join('')
    formattedLines.push(line)
  }

  return formattedLines.join('\n')
}

/** A run of same-coloured characters within a single row. */
export interface ColoredSegment {
  text: string
  color: string
}

/**
 * Group the flat cell buffer into per-row runs of same-coloured text, so SVG
 * export can reproduce the per-cell colours scripts emit. Cells without an
 * explicit colour fall back to `defaultColor`. Each returned row is exactly
 * `width` characters wide (short rows are padded with spaces) so vertical
 * positioning stays aligned, matching `getContent`.
 */
export const getColoredRows = (
  dimensions: { width: number; height: number },
  source: BufferSource | null,
  defaultColor: string,
): ColoredSegment[][] => {
  if (!source) return []

  const buffer = source.getBuffer()
  const { width, height } = dimensions
  const rows: ColoredSegment[][] = []

  for (let r = 0; r < height; r++) {
    const segments: ColoredSegment[] = []

    for (let c = 0; c < width; c++) {
      const cell = buffer[r * width + c]
      const char = cell?.char || ' '
      const color = cell?.color || defaultColor

      const last = segments[segments.length - 1]
      if (last && last.color === color) last.text += char
      else segments.push({ text: char, color })
    }

    rows.push(segments)
  }

  return rows
}
