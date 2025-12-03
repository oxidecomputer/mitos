/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { invariant, type Cell, type Context } from '../animation'

export default function createRenderer() {
  function render(context: Context, buffer: Cell[]): void {
    const canvas = context.settings.element as HTMLCanvasElement

    invariant(!!canvas, 'Canvas element is required')

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('Could not get canvas context')
      return
    }

    // Validate dimensions
    if (
      context.rows <= 0 ||
      context.cols <= 0 ||
      !isFinite(context.rows) ||
      !isFinite(context.cols)
    ) {
      console.error(`Invalid dimensions: ${context.cols} x ${context.rows}`)
      return
    }

    const scale = devicePixelRatio
    const m = context.metrics

    // Validate metrics
    if (!m.cellWidth || !m.lineHeight || m.cellWidth <= 0 || m.lineHeight <= 0) {
      console.error('Invalid metrics:', m)
      return
    }

    // Get padding from settings (default to 0)
    const padding = context.settings.padding || 0

    // Calculate canvas dimensions based on character grid + padding
    const canvasWidth = context.cols * m.cellWidth + padding * 2
    const canvasHeight = context.rows * m.lineHeight + padding * 2

    // Set canvas size
    canvas.width = canvasWidth * scale
    canvas.height = canvasHeight * scale
    canvas.style.width = canvasWidth + 'px'
    canvas.style.height = canvasHeight + 'px'

    // Get colors from settings
    const backgroundColor = context.settings.backgroundColor || 'white'
    const textColor = context.settings.textColor || 'black'

    // Fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Setup text rendering
    ctx.save()
    ctx.scale(scale, scale)
    ctx.fillStyle = textColor
    ctx.font = `${m.fontSize}px ${m.fontFamily}`
    ctx.textBaseline = 'top'

    // Render cells with padding offset
    for (let j = 0; j < context.rows; j++) {
      for (let i = 0; i < context.cols; i++) {
        const cell = buffer[j * context.cols + i]
        const x = i * m.cellWidth + padding
        const y = j * m.lineHeight + padding

        ctx.fillText(cell?.char || ' ', x, y)
      }
    }

    ctx.restore()
  }

  return {
    render,
  }
}
