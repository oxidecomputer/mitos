/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useCallback, useEffect, useState } from 'react'

import { InputNumber, InputSwitch } from '~/lib/ui/src'

import { SourceType } from './ascii-art-generator'
import { CHAR_HEIGHT, CHAR_WIDTH } from './dimension-utils'

export interface AspectRatioInputNumberProps {
  width: number
  height: number
  onWidthChange: (value: number) => void
  onHeightChange: (value: number) => void
  aspectRatioFromImg?: boolean
  onAspectRatioFromImgChange?: (value: boolean) => void
  aspectRatio?: number
  onAspectRatioChange: (value: number | undefined) => void
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  disabled?: boolean
  className?: string
  sourceType: SourceType
}

const calculateAspectRatio = (w: number, h: number) => (w * CHAR_WIDTH) / (h * CHAR_HEIGHT)
const getHeightFromWidth = (w: number, ratio: number) =>
  Math.round((w * CHAR_WIDTH) / (ratio * CHAR_HEIGHT))
const getWidthFromHeight = (h: number, ratio: number) =>
  Math.round((ratio * h * CHAR_HEIGHT) / CHAR_WIDTH)

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))

export const AspectRatioInputNumber = ({
  width,
  height,
  onWidthChange,
  onHeightChange,
  aspectRatioFromImg = false,
  onAspectRatioFromImgChange,
  aspectRatio,
  onAspectRatioChange,
  disabled = false,
  sourceType,
}: AspectRatioInputNumberProps) => {
  const [isLocked, setIsLocked] = useState(aspectRatio !== undefined)

  const minWidth = 8
  const maxWidth = 240
  const minHeight = 4
  const maxHeight = 120

  // Calculate valid min/max dimension ranges when aspect ratio is locked
  const dimensionRanges = useCallback(() => {
    if (!aspectRatio || !isLocked) {
      return { minWidth, maxWidth, minHeight, maxHeight }
    }

    return {
      minWidth: clamp(getWidthFromHeight(minHeight, aspectRatio), minWidth, maxWidth),
      maxWidth: clamp(getWidthFromHeight(maxHeight, aspectRatio), minWidth, maxWidth),
      minHeight: clamp(getHeightFromWidth(minWidth, aspectRatio), minHeight, maxHeight),
      maxHeight: clamp(getHeightFromWidth(maxWidth, aspectRatio), minHeight, maxHeight),
    }
  }, [aspectRatio, isLocked, minWidth, maxWidth, minHeight, maxHeight])

  // When width changes and ratio is locked, update height
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      const ranges = dimensionRanges()
      const clampedWidth = clamp(newWidth, ranges.minWidth, ranges.maxWidth)

      onWidthChange(clampedWidth)

      if (isLocked && aspectRatio) {
        const newHeight = clamp(
          getHeightFromWidth(clampedWidth, aspectRatio),
          ranges.minHeight,
          ranges.maxHeight,
        )
        onHeightChange(newHeight)
      }
    },
    [isLocked, aspectRatio, dimensionRanges, onWidthChange, onHeightChange],
  )

  // When height changes and ratio is locked, update width
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      const ranges = dimensionRanges()
      const clampedHeight = clamp(newHeight, ranges.minHeight, ranges.maxHeight)

      onHeightChange(clampedHeight)

      if (isLocked && aspectRatio) {
        const newWidth = clamp(
          getWidthFromHeight(clampedHeight, aspectRatio),
          ranges.minWidth,
          ranges.maxWidth,
        )
        onWidthChange(newWidth)
      }
    },
    [isLocked, aspectRatio, dimensionRanges, onHeightChange, onWidthChange],
  )

  // When ratio changes directly, adjust dimensions while keeping width stable
  const handleAspectRatioChange = useCallback(
    (newRatio: number) => {
      onAspectRatioChange(newRatio)

      // When ratio changes, adjust height based on current width
      const newHeight = clamp(getHeightFromWidth(width, newRatio), minHeight, maxHeight)
      onHeightChange(newHeight)
    },
    [width, onAspectRatioChange, onHeightChange, minHeight, maxHeight],
  )

  const handleLockToggle = useCallback(
    (checked: boolean) => {
      setIsLocked(checked)
      if (checked) {
        // When locking, calculate and set aspect ratio based on current dimensions
        onAspectRatioChange(calculateAspectRatio(width, height))
      } else {
        // When unlocking, clear the aspect ratio
        onAspectRatioChange(undefined)
      }
    },
    [width, height, onAspectRatioChange],
  )

  useEffect(() => {
    if (aspectRatioFromImg && sourceType !== 'code' && !aspectRatio) {
      // Set aspect ratio from image dimensions when enabled
      onAspectRatioChange(calculateAspectRatio(width, height))
    }
  }, [aspectRatioFromImg, sourceType, aspectRatio, width, height, onAspectRatioChange])

  // Syncing dimensions when aspect ratio changes externally
  useEffect(() => {
    if (isLocked && aspectRatio) {
      const ranges = dimensionRanges()
      const newHeight = clamp(
        getHeightFromWidth(width, aspectRatio),
        ranges.minHeight,
        ranges.maxHeight,
      )

      // Avoid update loops with small floating point differences
      if (Math.abs(newHeight - height) > 0.01) {
        onHeightChange(newHeight)
      }
    }
  }, [aspectRatio, isLocked, width, height, dimensionRanges, onHeightChange])

  const ranges = dimensionRanges()

  return (
    <>
      <InputNumber
        value={width}
        onChange={handleWidthChange}
        min={ranges.minWidth}
        max={ranges.maxWidth}
        step={1}
        disabled={disabled}
      >
        Columns
      </InputNumber>
      <InputNumber
        value={height}
        onChange={handleHeightChange}
        min={ranges.minHeight}
        max={ranges.maxHeight}
        step={1}
        disabled={disabled}
      >
        Rows
      </InputNumber>

      <InputSwitch checked={isLocked} onChange={handleLockToggle} disabled={disabled}>
        Lock Aspect Ratio
      </InputSwitch>

      {isLocked && (
        <div className="mt-2 flex flex-col gap-2 border-l py-1 pl-3 border-default">
          <InputNumber
            value={aspectRatio || 1}
            onChange={handleAspectRatioChange}
            min={0.1}
            max={10}
            step={0.01}
            disabled={disabled || aspectRatioFromImg}
            showSlider={false}
          >
            Aspect Ratio
          </InputNumber>

          {sourceType !== 'code' && (
            <InputSwitch
              checked={aspectRatioFromImg}
              onChange={(checked) => {
                if (onAspectRatioFromImgChange) {
                  onAspectRatioFromImgChange(checked)
                }
              }}
            >
              Use Image Ratio
            </InputSwitch>
          )}
        </div>
      )}
    </>
  )
}
