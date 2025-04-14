/*
 * This Source Code Form is subject to the terms of the Apache License,
 * v. 2.0. If a copy of the license was not distributed with this file, you can
 * obtain one at https://github.com/ertdfgcvb/play.core/blob/master/LICENSE.
 *
 * Modified from https://github.com/ertdfgcvb/play.core
 * Copyright ertdfgcvb (Andreas Gysin)
 */
import { invariant, type Cell, type Context } from '../animation'

export default function createRenderer() {
  const backBuffer: Cell[] = []
  let cols: number, rows: number

  function render(context: Context, buffer: Cell[]): void {
    const element = context.settings.element

    invariant(!!element, 'Element is required')

    // Detect resize and validate dimensions
    if (context.rows !== rows || context.cols !== cols) {
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

      cols = context.cols
      rows = context.rows
      backBuffer.length = 0
    }

    // DOM rows update: expand lines if necessary
    while (element.childElementCount < rows) {
      const span = document.createElement('span')
      span.style.display = 'block'
      element.appendChild(span)
    }

    // DOM rows update: shorten lines if necessary
    while (element.childElementCount > rows) {
      const lastChild = element.lastChild
      if (lastChild) element.removeChild(lastChild)
    }

    // Set default text color to black for white background
    element.style.color = 'black'
    element.style.backgroundColor = 'transparent'

    // A bit of a cumbersome render-loop…
    // A few notes: the fastest way I found to render the image
    // is by manually write the markup into the parent node via .innerHTML;
    // creating a node via .createElement and then popluate it resulted
    // remarkably slower (even if more elegant for the CSS handling below).
    for (let j = 0; j < rows; j++) {
      const offs = j * cols

      // This check is faster than to force update the DOM.
      // Buffer can be manually modified in pre, main and after
      // with semi-arbitrary values…
      // It is necessary to keep track of the previous state
      // and specifically check if a change in style
      // or char happened on the whole row.
      let rowNeedsUpdate = false
      for (let i = 0; i < cols; i++) {
        const idx = i + offs
        if (idx >= buffer.length) {
          continue
        }

        const newCell = buffer[idx]
        const oldCell = backBuffer[idx]
        if (!isSameCell(newCell, oldCell)) {
          rowNeedsUpdate = true
          backBuffer[idx] = { ...newCell }
        }
      }

      // Skip row if update is not necessary
      if (rowNeedsUpdate === false) continue

      let html = '' // Accumulates the markup
      let prevCell = { char: '' } // defaultCell
      let tagIsOpen = false

      for (let i = 0; i < cols; i++) {
        const idx = i + offs
        if (idx >= buffer.length) continue

        const currCell = buffer[idx]

        // If there is a change in style a new span has to be inserted
        if (!isSameCellStyle(currCell, prevCell)) {
          // Close the previous tag
          if (tagIsOpen) html += '</span>'

          const c = currCell.color === context.settings.color ? null : currCell.color
          const b =
            currCell.backgroundColor === context.settings.backgroundColor
              ? null
              : currCell.backgroundColor
          const w =
            currCell.fontWeight === context.settings.fontWeight ? null : currCell.fontWeight

          // Accumulate the CSS inline attribute.
          let css = ''
          if (c) css += 'color:' + c + ';'
          if (b) css += 'background:' + b + ';'
          if (w) css += 'font-weight:' + w + ';'
          if (css) css = ' style="' + css + '"'
          html += '<span' + css + '>'
          tagIsOpen = true
        }
        html += currCell.char || ' '
        prevCell = currCell
      }
      if (tagIsOpen) {
        html += '</span>'
      }

      // Write the row
      if (j < element.childElementCount) {
        const childNode = element.childNodes[j] as HTMLSpanElement
        childNode.innerHTML = html
      }
    }
  }

  // Move helper functions inside closure to access backBuffer
  function isSameCell(cellA: Cell | undefined, cellB: Cell | undefined): boolean {
    if (typeof cellA !== 'object') return false
    if (typeof cellB !== 'object') return false
    if (cellA?.char !== cellB?.char) return false
    if (cellA?.fontWeight !== cellB?.fontWeight) return false
    if (cellA?.color !== cellB?.color) return false
    if (cellA?.backgroundColor !== cellB?.backgroundColor) return false
    return true
  }

  function isSameCellStyle(cellA: Cell, cellB: Cell): boolean {
    if (cellA?.fontWeight !== cellB?.fontWeight) return false
    if (cellA?.color !== cellB?.color) return false
    if (cellA?.backgroundColor !== cellB?.backgroundColor) return false
    return true
  }

  return {
    render,
  }
}
