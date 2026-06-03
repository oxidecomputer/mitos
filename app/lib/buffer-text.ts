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
