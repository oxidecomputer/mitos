import { useRef } from 'react'

import type { GridType } from './ascii-art-generator'

interface GridOverlayProps {
  grid: GridType
  cols: number
  rows: number
}

export function GridOverlay({ grid, cols, rows }: GridOverlayProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  const viewBoxSize = 1000
  const maxDimension = Math.max(cols, rows)
  const baseStrokeWidth = 1
  const strokeWidth = Math.max(0.5, baseStrokeWidth * (50 / maxDimension))

  let horizontalPath = ''
  let verticalPath = ''

  if (grid === 'horizontal' || grid === 'both') {
    for (let y = 1; y < rows; y++) {
      const yPos = Math.round((y / rows) * viewBoxSize) // Round to avoid sub-pixel rendering
      horizontalPath += `M 0,${yPos} L ${viewBoxSize},${yPos} `
    }
  }

  if (grid === 'vertical' || grid === 'both') {
    for (let x = 1; x < cols; x++) {
      const xPos = Math.round((x / cols) * viewBoxSize) // Round to avoid sub-pixel rendering
      verticalPath += `M ${xPos},0 L ${xPos},${viewBoxSize} `
    }
  }

  return (
    <div
      ref={gridRef}
      className="grid-overlay text-quaternary pointer-events-none absolute inset-0 z-10"
      data-grid-type={grid}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        preserveAspectRatio="none"
      >
        {horizontalPath && (
          <path
            d={horizontalPath}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}
        {verticalPath && (
          <path
            d={verticalPath}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}
      </svg>
    </div>
  )
}
