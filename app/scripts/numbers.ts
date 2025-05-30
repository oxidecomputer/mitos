/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

export const numbers = `// Pixel font definition - each number as 9 rows, 8 columns
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

// What is rendered
const string = '1234567890'

// Font dimensions and scaling
const FONT_WIDTH = 8
const FONT_HEIGHT = 9
const CHAR_SPACING = 2
const SCALE = 1 // Scale factor (1 = normal, 2 = 2x, 3 = 3x, etc.)

const SCALED_FONT_WIDTH = FONT_WIDTH * SCALE
const SCALED_FONT_HEIGHT = FONT_HEIGHT * SCALE
const SCALED_CHAR_SPACING = CHAR_SPACING * SCALE
const TOTAL_CHAR_WIDTH = SCALED_FONT_WIDTH + SCALED_CHAR_SPACING

function main(coord, context, cursor, buffer) {
  const { x, y } = coord

  if (y >= SCALED_FONT_HEIGHT) {
    return ' '
  }

  // Calculate which character we're in
  const charIndex = Math.floor(x / TOTAL_CHAR_WIDTH)

  // Check if we're beyond the string length
  if (charIndex >= string.length) {
    return ' '
  }

  // Calculate position within the current character slot
  const localX = x % TOTAL_CHAR_WIDTH

  // If we're in the spacing area, return space
  if (localX >= SCALED_FONT_WIDTH) {
    return ' '
  }

  // Get the current digit
  const digit = string[charIndex]

  // Check if it's a valid digit
  if (digit < '0' || digit > '9') {
    return ' '
  }

  // Scale down to find the original font position
  const fontX = Math.floor(localX / SCALE)
  const fontY = Math.floor(y / SCALE)

  // Get the pixel from the font
  const digitIndex = parseInt(digit)
  const fontRow = pixelFont[digitIndex][fontY]
  const pixel = fontRow[fontX]

  // Return the digit character if pixel is '1', otherwise space
  return pixel === '1' ? digit : ' '
}`
