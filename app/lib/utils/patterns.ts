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
