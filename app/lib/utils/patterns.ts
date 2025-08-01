/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

/**
 * Generates a checkerboard pattern value for given coordinates
 * @param x - X coordinate of the cell
 * @param y - Y coordinate of the cell
 * @param size - Size of each checker square
 * @returns 0 or 1 representing the checkerboard pattern
 */
export function checkerboard(x: number, y: number, size: number = 8): number {
  const checkerX = Math.floor(x / size)
  const checkerY = Math.floor(y / size)
  return (checkerX + checkerY) % 2
}

/**
 * Generates a striped pattern value for given coordinates
 * @param x - X coordinate of the cell
 * @param y - Y coordinate of the cell
 * @param stripeWidth - Width of each stripe
 * @param direction - Direction of stripes ('horizontal' | 'vertical' | 'diagonal')
 * @returns 0 or 1 representing the striped pattern
 */
export function stripes(
  x: number,
  y: number,
  stripeWidth: number = 4,
  direction: 'horizontal' | 'vertical' | 'diagonal' = 'vertical',
): number {
  switch (direction) {
    case 'horizontal':
      return Math.floor(y / stripeWidth) % 2
    case 'diagonal':
      return Math.floor((x + y) / stripeWidth) % 2
    case 'vertical':
    default:
      return Math.floor(x / stripeWidth) % 2
  }
}

/**
 * Converts a 0-1 value to an ASCII character for rendering
 * @param value - Normalized value between 0 and 1
 * @param chars - Optional character set to use (defaults to density-based ASCII)
 * @returns ASCII character representing the value
 */
export function valueToChar(value: number, chars?: string): string {
  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value))

  // Default ASCII density characters (from darkest to lightest)
  const defaultChars = '@%#*+=-:. '
  const charSet = chars || defaultChars

  // Map value to character index
  const index = Math.floor(clampedValue * (charSet.length - 1))
  return charSet[index]
}

/**
 * Gets a value from 2D image data array
 * @param data - 2D array of 0-1 values [x][y]
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Value at coordinates or 0 if out of bounds
 */
export function getImageValue(data: number[][], x: number, y: number): number {
  if (!data || !data[x] || data[x][y] === undefined) {
    return 0
  }
  return data[x][y]
}
