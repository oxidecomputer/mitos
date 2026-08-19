/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

// Asssuming output is using "GT America Mono"
export const CHAR_WIDTH = 7.45
export const FONT_SIZE = 12
export const DEFAULT_LINE_HEIGHT = 1.2
export const LINE_HEIGHT_MIN = 0.8
export const LINE_HEIGHT_MAX = 1.6

// Project files and gists are arbitrary JSON, so the line height they carry
// can be missing, out of range, or not a number at all
export const clampLineHeight = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, value))
    : DEFAULT_LINE_HEIGHT

/**
 * Calculate content dimensions including padding
 */
export const calculateContentDimensions = (
  dimensions: { width: number; height: number },
  padding: number,
  lineHeight: number,
) => {
  const pixelWidth = dimensions.width * CHAR_WIDTH
  const pixelHeight = dimensions.height * FONT_SIZE * lineHeight
  const paddingPixels = padding * CHAR_WIDTH
  return {
    pixelWidth,
    pixelHeight,
    paddingPixels,
    totalWidth: pixelWidth + paddingPixels * 2,
    totalHeight: pixelHeight + paddingPixels * 2,
  }
}

/**
 * Calculate aspect ratio from total dimensions
 */
export const calculateAspectRatio = (totalWidth: number, totalHeight: number) =>
  totalHeight / totalWidth

/**
 * Calculate export dimensions maintaining aspect ratio
 */
export const calculateExportDimensions = (
  dimensions: { width: number; height: number },
  padding: number,
  lineHeight: number,
  baseWidth?: number,
  baseHeight?: number,
) => {
  const { totalWidth, totalHeight } = calculateContentDimensions(
    dimensions,
    padding,
    lineHeight,
  )
  const aspectRatio = calculateAspectRatio(totalWidth, totalHeight)

  if (baseWidth) {
    return {
      width: baseWidth,
      height: Math.round(baseWidth * aspectRatio),
    }
  }

  if (baseHeight) {
    return {
      width: Math.round(baseHeight / aspectRatio),
      height: baseHeight,
    }
  }

  // Default dimensions if no base provided
  return {
    width: Math.round(totalWidth),
    height: Math.round(totalHeight),
  }
}
