/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import type { Cell } from './animation'

export interface Coord {
  x: number
  y: number
}

export interface Data {
  [x: number]: {
    [y: number]: Cell
  }
}

export const emptyCell: Cell = {
  char: ' ',
}

export const renderFromData = (data: Data, coord: Coord): Cell => {
  if (!data[coord.x] || coord.x < 0 || coord.y < 0) {
    return emptyCell
  }

  const cell = data[coord.x][coord.y]

  if (cell) {
    return {
      char: cell.char || ' ',
    }
  } else {
    return emptyCell
  }
}
