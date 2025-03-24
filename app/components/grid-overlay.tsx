import { useRef } from 'react'

import type { GridType } from './ascii-art-generator'

interface GridOverlayProps {
  grid: GridType
  cols: number
  rows: number
}

export function GridOverlay({ grid, cols, rows }: GridOverlayProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  let horizontalPath = ''
  let verticalPath = ''

  if (grid === 'horizontal' || grid === 'both') {
    for (let y = 1; y < rows; y++) {
      const yRatio = y / rows // Position as a ratio (0-1)
      horizontalPath += `M 0,${yRatio} L 1,${yRatio} `
    }
  }

  if (grid === 'vertical' || grid === 'both') {
    for (let x = 1; x < cols; x++) {
      const xRatio = x / cols // Position as a ratio (0-1)
      verticalPath += `M ${xRatio},0 L ${xRatio},1 `
    }
  }

  return (
    <div ref={gridRef} className="pointer-events-none absolute inset-0 z-10">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1 1"
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        preserveAspectRatio="none"
      >
        {horizontalPath && (
          <path d={horizontalPath} stroke="#666666" strokeWidth="0.001" fill="none" />
        )}
        {verticalPath && (
          <path d={verticalPath} stroke="#666666" strokeWidth="0.001" fill="none" />
        )}
      </svg>
    </div>
  )
}
