/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
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
  // Lock ratio by default when aspectRatio is provided
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

  // Calculate effective min/max values that respect aspect ratio constraints
  // These functions determine the boundary values to prevent distortion
  const getMaxWidthForAspectRatio = useCallback(
    (ratio: number) => {
      if (!ratio) return maxWidth
      // The maximum width is the smaller of maxWidth and the width that would make height exactly maxHeight
      return Math.min(maxWidth, getWidthFromHeight(maxHeight, ratio))
    },
    [maxWidth, maxHeight, getWidthFromHeight],
  )

  const getMinWidthForAspectRatio = useCallback(
    (ratio: number) => {
      if (!ratio) return minWidth
      // The minimum width is the larger of minWidth and the width that would make height exactly minHeight
      return Math.max(minWidth, getWidthFromHeight(minHeight, ratio))
    },
    [minWidth, minHeight, getWidthFromHeight],
  )

  const getMaxHeightForAspectRatio = useCallback(
    (ratio: number) => {
      if (!ratio) return maxHeight
      // The maximum height is the smaller of maxHeight and the height that would make width exactly maxWidth
      return Math.min(maxHeight, getHeightFromWidth(maxWidth, ratio))
    },
    [maxHeight, maxWidth, getHeightFromWidth],
  )

  const getMinHeightForAspectRatio = useCallback(
    (ratio: number) => {
      if (!ratio) return minHeight
      // The minimum height is the larger of minHeight and the height that would make width exactly minWidth
      return Math.max(minHeight, getHeightFromWidth(minWidth, ratio))
    },
    [minHeight, minWidth, getHeightFromWidth],
  )

  // Update handler for width changes
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      setLastUpdated('width')

      if (isLocked && aspectRatio) {
        // When locked, calculate effective min/max width based on aspect ratio and height constraints
        const effectiveMinWidth = getMinWidthForAspectRatio(aspectRatio)
        const effectiveMaxWidth = getMaxWidthForAspectRatio(aspectRatio)

        // Clamp width to effective range that respects aspect ratio and height bounds
        const clampedWidth = Math.min(
          effectiveMaxWidth,
          Math.max(effectiveMinWidth, newWidth),
        )

        // Calculate height based on clamped width
        const newHeight = getHeightFromWidth(clampedWidth, aspectRatio)

        // Update both values
        setInternalWidth(clampedWidth)
        setInternalHeight(newHeight)

        // Call callbacks
        onWidthChange(clampedWidth)
        onHeightChange(newHeight)
      } else {
        // Not locked - just clamp to regular min/max
        const clampedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth))
        setInternalWidth(clampedWidth)
        onWidthChange(clampedWidth)
      }
    },
    [
      isLocked,
      aspectRatio,
      getHeightFromWidth,
      getMinWidthForAspectRatio,
      getMaxWidthForAspectRatio,
      minWidth,
      maxWidth,
      onWidthChange,
      onHeightChange,
    ],
  )

  // Update handler for height changes
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      setLastUpdated('height')

      if (isLocked && aspectRatio) {
        // When locked, calculate effective min/max height based on aspect ratio and width constraints
        const effectiveMinHeight = getMinHeightForAspectRatio(aspectRatio)
        const effectiveMaxHeight = getMaxHeightForAspectRatio(aspectRatio)

        // Clamp height to effective range that respects aspect ratio and width bounds
        const clampedHeight = Math.min(
          effectiveMaxHeight,
          Math.max(effectiveMinHeight, newHeight),
        )

        // Calculate width based on clamped height
        const newWidth = getWidthFromHeight(clampedHeight, aspectRatio)

        // Update both values
        setInternalHeight(clampedHeight)
        setInternalWidth(newWidth)

        // Call callbacks
        onHeightChange(clampedHeight)
        onWidthChange(newWidth)
      } else {
        // Not locked - just clamp to regular min/max
        const clampedHeight = Math.min(maxHeight, Math.max(minHeight, newHeight))
        setInternalHeight(clampedHeight)
        onHeightChange(clampedHeight)
      }
    },
    [
      isLocked,
      aspectRatio,
      getWidthFromHeight,
      getMinHeightForAspectRatio,
      getMaxHeightForAspectRatio,
      minHeight,
      maxHeight,
      onHeightChange,
      onWidthChange,
    ],
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

  // Update lock state and dimensions when aspectRatio changes
  useEffect(() => {
    if (aspectRatio !== undefined) {
      // When aspect ratio is set, lock it
      if (!isLocked) {
        setIsLocked(true)
      }

      // Always update dimensions when aspect ratio changes
      const newHeight = getHeightFromWidth(width, aspectRatio)

      // Update internal state AND parent state
      setInternalHeight(newHeight)
      setLastUpdated('width')
      onHeightChange(newHeight)
    }
  }, [aspectRatio, isLocked, width, getHeightFromWidth, onHeightChange])

  return (
    <>
      <InputNumber
        value={internalWidth}
        onChange={handleWidthChange}
        min={isLocked && aspectRatio ? getMinWidthForAspectRatio(aspectRatio) : minWidth}
        max={isLocked && aspectRatio ? getMaxWidthForAspectRatio(aspectRatio) : maxWidth}
        step={1}
        disabled={disabled}
      >
        Columns
      </InputNumber>
      <InputNumber
        value={internalHeight}
        onChange={handleHeightChange}
        min={isLocked && aspectRatio ? getMinHeightForAspectRatio(aspectRatio) : minHeight}
        max={isLocked && aspectRatio ? getMaxHeightForAspectRatio(aspectRatio) : maxHeight}
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
          <div className="mt-2 border-l py-1 pl-3 border-default">
            <InputNumber
              value={aspectRatio || 1}
              onChange={handleAspectRatioChange}
              min={0.1}
              max={10}
              step={0.01}
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
