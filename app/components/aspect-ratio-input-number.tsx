import { useCallback, useEffect, useState } from 'react'

import { InputNumber, InputSwitch } from '~/lib/ui/src'

// Constants for character dimensions
export const CHAR_WIDTH = 7.45
export const CHAR_HEIGHT = 15

export interface AspectRatioInputNumberProps {
  width: number
  height: number
  onWidthChange: (value: number) => void
  onHeightChange: (value: number) => void
  aspectRatio?: number
  onAspectRatioChange: (value: number | undefined) => void
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  disabled?: boolean
  className?: string
}

export const AspectRatioInputNumber = ({
  width,
  height,
  onWidthChange,
  onHeightChange,
  aspectRatio,
  onAspectRatioChange,
  minWidth = 20,
  maxWidth = 240,
  minHeight = 10,
  maxHeight = 120,
  disabled = false,
}: AspectRatioInputNumberProps) => {
  const [internalWidth, setInternalWidth] = useState(width)
  const [internalHeight, setInternalHeight] = useState(height)
  const [lastUpdated, setLastUpdated] = useState<'width' | 'height' | null>('width')
  const [isLocked, setIsLocked] = useState(aspectRatio !== undefined)

  // Helper functions for aspect ratio calculations
  const getHeightFromWidth = useCallback(
    (w: number, ratio: number) => {
      const newHeight = Math.round((w * CHAR_WIDTH) / (ratio * CHAR_HEIGHT))
      return Math.min(maxHeight, Math.max(minHeight, newHeight))
    },
    [minHeight, maxHeight],
  )

  const getWidthFromHeight = useCallback(
    (h: number, ratio: number) => {
      const newWidth = Math.round((ratio * h * CHAR_HEIGHT) / CHAR_WIDTH)
      return Math.min(maxWidth, Math.max(minWidth, newWidth))
    },
    [minWidth, maxWidth],
  )

  const calculateAspectRatio = useCallback((w: number, h: number) => {
    return (w * CHAR_WIDTH) / (h * CHAR_HEIGHT)
  }, [])

  // Sync internal state with props
  useEffect(() => {
    setInternalWidth(width)
    setInternalHeight(height)
  }, [width, height])

  // Update handler for width changes
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      setLastUpdated('width')
      setInternalWidth(newWidth)

      if (isLocked && aspectRatio) {
        const newHeight = getHeightFromWidth(newWidth, aspectRatio)
        setInternalHeight(newHeight)

        // Call both callbacks to update parent state
        onWidthChange(newWidth)
        onHeightChange(newHeight)
      } else {
        onWidthChange(newWidth)
      }
    },
    [isLocked, aspectRatio, getHeightFromWidth, onWidthChange, onHeightChange],
  )

  // Update handler for height changes
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      setLastUpdated('height')
      setInternalHeight(newHeight)

      if (isLocked && aspectRatio) {
        const newWidth = getWidthFromHeight(newHeight, aspectRatio)
        setInternalWidth(newWidth)

        // Call both callbacks to update parent state
        onHeightChange(newHeight)
        onWidthChange(newWidth)
      } else {
        onHeightChange(newHeight)
      }
    },
    [isLocked, aspectRatio, getWidthFromHeight, onHeightChange, onWidthChange],
  )

  // Handle aspect ratio changes
  const handleAspectRatioChange = useCallback(
    (newRatio: number) => {
      onAspectRatioChange(newRatio)

      let newWidth = internalWidth
      let newHeight = internalHeight

      if (lastUpdated === 'width' || !lastUpdated) {
        newHeight = getHeightFromWidth(internalWidth, newRatio)
        setInternalHeight(newHeight)
      } else {
        newWidth = getWidthFromHeight(internalHeight, newRatio)
        setInternalWidth(newWidth)
      }

      // Propagate both changes to parent
      onWidthChange(newWidth)
      onHeightChange(newHeight)
    },
    [
      internalWidth,
      internalHeight,
      lastUpdated,
      getHeightFromWidth,
      getWidthFromHeight,
      onAspectRatioChange,
      onWidthChange,
      onHeightChange,
    ],
  )

  // Handle lock toggle
  const handleLockToggle = useCallback(
    (checked: boolean) => {
      setIsLocked(checked)

      if (checked) {
        const currentRatio = calculateAspectRatio(width, height)
        onAspectRatioChange(currentRatio)
      } else {
        onAspectRatioChange(undefined)
      }
    },
    [width, height, calculateAspectRatio, onAspectRatioChange],
  )

  // Initialize dimensions based on aspect ratio if needed
  useEffect(() => {
    if (isLocked && aspectRatio && !lastUpdated) {
      const newHeight = getHeightFromWidth(internalWidth, aspectRatio)
      setInternalHeight(newHeight)
      setLastUpdated('width')
    }
  }, [isLocked, aspectRatio, lastUpdated, internalWidth, getHeightFromWidth])

  return (
    <>
      <InputNumber
        value={internalWidth}
        onChange={handleWidthChange}
        min={minWidth}
        max={maxWidth}
        step={1}
        disabled={disabled}
      >
        Columns
      </InputNumber>
      <InputNumber
        value={internalHeight}
        onChange={handleHeightChange}
        min={minHeight}
        max={maxHeight}
        step={1}
        disabled={disabled}
      >
        Rows
      </InputNumber>

      <div>
        <InputSwitch checked={isLocked} onChange={handleLockToggle}>
          Lock Aspect Ratio
        </InputSwitch>

        {isLocked && (
          <div className="border-default mt-2 border-l py-1 pl-3">
            <InputNumber
              value={aspectRatio || 1}
              onChange={handleAspectRatioChange}
              min={0.1}
              max={10}
              step={0.1}
              disabled={disabled}
              showSlider={false}
            >
              Aspect Ratio
            </InputNumber>
          </div>
        )}
      </div>
    </>
  )
}
