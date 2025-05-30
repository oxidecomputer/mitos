/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

export const clock = `// Pixel font definition - each number as 9 rows, 8 columns
const pixelFont = [
  [
    ' 111111 ',
    '11    11',
    '11    11',
    '11  1 11',
    '11 11 11',
    '11 1  11',
    '11    11',
    '11    11',
    ' 111111 ',
  ],
  [
    '   11   ',
    ' 1111   ',
    '   11   ',
    '   11   ',
    '   11   ',
    '   11   ',
    '   11   ',
    '   11   ',
    '11111111',
  ],
  [
    '  1111  ',
    '11    11',
    '      11',
    '     11 ',
    '    11  ',
    '   11   ',
    '  11    ',
    ' 11     ',
    '11111111',
  ],
  [
    ' 111111 ',
    '11    11',
    '      11',
    '      11',
    '  11111 ',
    '      11',
    '      11',
    '11    11',
    ' 111111 ',
  ],
  [
    '     11 ',
    '    111 ',
    '   1111 ',
    '  11 11 ',
    ' 11  11 ',
    '11   11 ',
    '11111111',
    '     11 ',
    '     11 ',
  ],
  [
    '11111111',
    '11      ',
    '11      ',
    '11      ',
    '1111111 ',
    '      11',
    '      11',
    '11    11',
    ' 111111 ',
  ],
  [
    ' 111111 ',
    '11    11',
    '11      ',
    '11      ',
    '1111111 ',
    '11    11',
    '11    11',
    '11    11',
    ' 111111 ',
  ],
  [
    '11111111',
    '      11',
    '      11',
    '     11 ',
    '    11  ',
    '   11   ',
    '  11    ',
    ' 11     ',
    ' 11     ',
  ],
  [
    ' 111111 ',
    '11    11',
    '11    11',
    '11    11',
    ' 111111 ',
    '11    11',
    '11    11',
    '11    11',
    ' 111111 ',
  ],
  [
    ' 111111 ',
    '11    11',
    '11    11',
    '11    11',
    ' 1111111',
    '      11',
    '      11',
    '11    11',
    ' 111111 ',
  ],
]

// Colon character definition (3 columns wide)
const colonFont = ['   ', '   ', ' 1 ', ' 1 ', '   ', ' 1 ', ' 1 ', '   ', '   ']

// What is rendered - will be updated with current time
let string = '00:00:00'

// Font dimensions and scaling
const FONT_WIDTH = 8
const COLON_WIDTH = 3
const FONT_HEIGHT = 9
const CHAR_SPACING = 1
const SCALE = 1 // Scale factor (1 = normal, 2 = 2x, 3 = 3x, etc.)

const SCALED_FONT_WIDTH = FONT_WIDTH * SCALE
const SCALED_COLON_WIDTH = COLON_WIDTH * SCALE
const SCALED_FONT_HEIGHT = FONT_HEIGHT * SCALE
const SCALED_CHAR_SPACING = CHAR_SPACING * SCALE

function updateClock() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  return \`\${hours}:\${minutes}:\${seconds}\`
}

function post(context, cursor, buffer, userData) {
  string = updateClock()
}

function main(coord, context, cursor, buffer) {
  const { x, y } = coord

  if (y >= SCALED_FONT_HEIGHT) {
    return ' '
  }

  let currentX = 0

  for (let i = 0; i < string.length; i++) {
    const char = string[i]

    if (char === ':') {
      // Handle colon character
      if (x >= currentX && x < currentX + SCALED_COLON_WIDTH) {
        const localX = x - currentX
        const fontX = Math.floor(localX / SCALE)
        const fontY = Math.floor(y / SCALE)

        const pixel = colonFont[fontY][fontX]
        return pixel === '1' ? ':' : ' '
      }
      currentX += SCALED_COLON_WIDTH + SCALED_CHAR_SPACING
    } else if (char >= '0' && char <= '9') {
      // Handle digit character
      if (x >= currentX && x < currentX + SCALED_FONT_WIDTH) {
        const localX = x - currentX
        const fontX = Math.floor(localX / SCALE)
        const fontY = Math.floor(y / SCALE)

        const digitIndex = parseInt(char)
        const fontRow = pixelFont[digitIndex][fontY]
        const pixel = fontRow[fontX]

        return pixel === '1' ? char : ' '
      }
      currentX += SCALED_FONT_WIDTH + SCALED_CHAR_SPACING
    }
  }

  return ' '
}`
