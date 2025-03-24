import type { Cell } from "./animation"

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
  char: " ",
  color: "#000000", // Default to black text for visibility on white background
  backgroundColor: undefined,
  fontWeight: undefined,
}

export const renderFromData = (data: Data, coord: Coord): Cell => {
  if (!data[coord.x] || coord.x < 0 || coord.y < 0) {
    return emptyCell
  }

  const cell = data[coord.x][coord.y]

  if (cell) {
    return {
      char: cell.char || " ",
      color: cell.color || "#000000", // Default to black if not specified
      backgroundColor: cell.backgroundColor,
      fontWeight: cell.fontWeight,
    }
  } else {
    return emptyCell
  }
}

