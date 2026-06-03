/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { describe, expect, test } from 'bun:test'

import type { Cell } from '~/lib/animation'
import { getColoredRows, getContent, type BufferSource } from '~/lib/buffer-text'

/** Build a BufferSource from a flat list of characters. */
const source = (chars: string[]): BufferSource => ({
  getBuffer: () => chars.map((char): Cell => ({ char })),
})

/** Build a BufferSource from rows of text (each string is one grid row). */
const grid = (rows: string[]): BufferSource => source(rows.flatMap((row) => row.split('')))

describe('getContent', () => {
  test('formats a flat buffer into a width x height grid', () => {
    const result = getContent({ width: 3, height: 2 }, grid(['abc', 'def']))
    expect(result).toBe('abc\ndef')
  })

  test('produces exactly `height` lines', () => {
    const result = getContent({ width: 2, height: 3 }, grid(['ab', 'cd', 'ef']))
    expect(result.split('\n')).toHaveLength(3)
  })

  test('each line is exactly `width` characters wide', () => {
    const result = getContent({ width: 4, height: 2 }, grid(['ab x', 'wxyz']))
    for (const line of result.split('\n')) {
      expect(line).toHaveLength(4)
    }
  })

  test('renders empty-string cells as a single space', () => {
    // Cells produced by the animation buffer can carry an empty char.
    const result = getContent({ width: 3, height: 1 }, source(['a', '', 'c']))
    expect(result).toBe('a c')
  })

  test('preserves significant whitespace within a row', () => {
    const result = getContent({ width: 5, height: 1 }, source(['a', ' ', ' ', 'b', ' ']))
    expect(result).toBe('a  b ')
  })

  test('preserves trailing whitespace (does not right-trim lines)', () => {
    const result = getContent({ width: 3, height: 2 }, grid(['a  ', 'b  ']))
    expect(result.split('\n')).toEqual(['a  ', 'b  '])
  })

  test('reads the buffer in row-major order', () => {
    // 2x2 grid: indices 0,1 are the top row; 2,3 the bottom row.
    const result = getContent({ width: 2, height: 2 }, source(['1', '2', '3', '4']))
    expect(result).toBe('12\n34')
  })

  test('ignores buffer cells beyond width * height', () => {
    // Buffer has an extra trailing cell that should not appear in the output.
    const result = getContent({ width: 2, height: 1 }, source(['a', 'b', 'EXTRA']))
    expect(result).toBe('ab')
  })

  test('returns empty string when the controller is null', () => {
    expect(getContent({ width: 4, height: 4 }, null)).toBe('')
  })

  test('handles a single cell', () => {
    expect(getContent({ width: 1, height: 1 }, source(['x']))).toBe('x')
  })

  test('produces empty lines when the buffer is shorter than the grid', () => {
    // Only the first row has data; the remaining requested rows are empty.
    const result = getContent({ width: 3, height: 3 }, source(['a', 'b', 'c']))
    expect(result).toBe('abc\n\n')
    expect(result.split('\n')).toHaveLength(3)
  })

  test('round-trips multi-line ascii art', () => {
    const art = ['  /\\  ', ' /  \\ ', '/____\\']
    const result = getContent({ width: 6, height: 3 }, grid(art))
    expect(result).toBe(art.join('\n'))
  })
})

/** Build a BufferSource from cells with optional per-cell colour. */
const colored = (cells: { char: string; color?: string }[]): BufferSource => ({
  getBuffer: () => cells.map((c): Cell => ({ char: c.char, color: c.color })),
})

describe('getColoredRows', () => {
  test('returns one segment array per row', () => {
    const rows = getColoredRows({ width: 2, height: 3 }, grid(['ab', 'cd', 'ef']), '#000')
    expect(rows).toHaveLength(3)
  })

  test('falls back to the default colour for uncoloured cells', () => {
    const rows = getColoredRows({ width: 3, height: 1 }, grid(['abc']), '#000')
    expect(rows[0]).toEqual([{ text: 'abc', color: '#000' }])
  })

  test('merges a run of same-coloured cells into one segment', () => {
    const rows = getColoredRows(
      { width: 3, height: 1 },
      colored([
        { char: 'a', color: 'red' },
        { char: 'b', color: 'red' },
        { char: 'c', color: 'red' },
      ]),
      '#000',
    )
    expect(rows[0]).toEqual([{ text: 'abc', color: 'red' }])
  })

  test('splits into separate segments when the colour changes', () => {
    const rows = getColoredRows(
      { width: 4, height: 1 },
      colored([
        { char: 'a', color: 'red' },
        { char: 'b', color: 'red' },
        { char: 'c', color: 'blue' },
        { char: 'd' },
      ]),
      '#000',
    )
    expect(rows[0]).toEqual([
      { text: 'ab', color: 'red' },
      { text: 'c', color: 'blue' },
      { text: 'd', color: '#000' },
    ])
  })

  test('pads short rows with default-coloured spaces to full width', () => {
    const rows = getColoredRows({ width: 4, height: 1 }, source(['a']), '#000')
    const text = rows[0].map((s) => s.text).join('')
    expect(text).toBe('a   ')
    expect(text).toHaveLength(4)
  })

  test('reads the buffer in row-major order', () => {
    const rows = getColoredRows(
      { width: 2, height: 2 },
      source(['1', '2', '3', '4']),
      '#000',
    )
    expect(rows.map((r) => r.map((s) => s.text).join(''))).toEqual(['12', '34'])
  })

  test('returns an empty array when the controller is null', () => {
    expect(getColoredRows({ width: 4, height: 4 }, null, '#000')).toEqual([])
  })
})
