/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Prefer a Display P3 canvas so wide-gamut colors (e.g. oklch) survive
// rendering and export. The first getContext call on a canvas fixes its color
// space, so every render/export canvas must go through this helper.
export function get2dContext(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d', { colorSpace: 'display-p3', ...options })
  } catch {
    // Browsers without display-p3 support throw — fall back to sRGB
    return canvas.getContext('2d', options)
  }
}
