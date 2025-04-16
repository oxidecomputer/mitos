/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useCallback, useEffect, useState } from 'react'

import { InputNumber, InputSwitch } from '~/lib/ui/src'

export const CHAR_WIDTH = 7.45
export const CHAR_HEIGHT = 15

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
}

export const AspectRatioInputNumber = ({
  width,
  height,
  onWidthChange,
  onHeightChange,
  aspectRatioFromImg = false,
  onAspectRatioFromImgChange,
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
  const [useRatio, setUseRatio] = useState(aspectRatioFromImg)
  const [isLocked, setIsLocked] = useState(aspectRatio !== undefined)

  const calculateAspectRatio = (w: number, h: number) =>
    (w * CHAR_WIDTH) / (h * CHAR_HEIGHT)
  const getHeightFromWidth = (w: number, ratio: number) =>
    Math.round((w * CHAR_WIDTH) / (ratio * CHAR_HEIGHT))
  const getWidthFromHeight = (h: number, ratio: number) =>
    Math.round((ratio * h * CHAR_HEIGHT) / CHAR_WIDTH)

  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))

  const getDimensionRange = useCallback(
    (ratio: number | undefined) => {
      if (!ratio || !isLocked) {
        return {
          minWidth,
          maxWidth,
          minHeight,
          maxHeight,
        }
      }

      return {
        minWidth: clamp(getWidthFromHeight(minHeight, ratio), minWidth, maxWidth),
        maxWidth: clamp(getWidthFromHeight(maxHeight, ratio), minWidth, maxWidth),
        minHeight: clamp(getHeightFromWidth(minWidth, ratio), minHeight, maxHeight),
        maxHeight: clamp(getHeightFromWidth(maxWidth, ratio), minHeight, maxHeight),
      }
    },
    [minWidth, maxWidth, minHeight, maxHeight, isLocked],
  )

  useEffect(() => {
    setInternalWidth(width)
    setInternalHeight(height)
  }, [width, height])

  useEffect(() => {
    setUseRatio(aspectRatioFromImg)
    if (aspectRatioFromImg) {
      if (!isLocked) {
        setIsLocked(true)
      }
      if (aspectRatio === undefined) {
        onAspectRatioChange(calculateAspectRatio(width, height))
      }
    }
  }, [aspectRatioFromImg, isLocked, width, height, onAspectRatioChange, aspectRatio])

  const handleWidthChange = useCallback(
    (newWidth: number) => {
      if (isLocked && aspectRatio) {
        const { minWidth, maxWidth } = getDimensionRange(aspectRatio)
        const clampedWidth = clamp(newWidth, minWidth, maxWidth)
        const newHeight = clamp(
          getHeightFromWidth(clampedWidth, aspectRatio),
          minHeight,
          maxHeight,
        )

        setInternalWidth(clampedWidth)
        setInternalHeight(newHeight)
        onWidthChange(clampedWidth)
        onHeightChange(newHeight)
      } else {
        const clamped = clamp(newWidth, minWidth, maxWidth)
        setInternalWidth(clamped)
        onWidthChange(clamped)
      }
    },
    [
      isLocked,
      aspectRatio,
      getDimensionRange,
      onWidthChange,
      onHeightChange,
      minHeight,
      maxHeight,
      minWidth,
      maxWidth,
    ],
  )

  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (isLocked && aspectRatio) {
        const { minHeight, maxHeight } = getDimensionRange(aspectRatio)
        const clampedHeight = clamp(newHeight, minHeight, maxHeight)
        const newWidth = clamp(
          getWidthFromHeight(clampedHeight, aspectRatio),
          minWidth,
          maxWidth,
        )

        setInternalHeight(clampedHeight)
        setInternalWidth(newWidth)
        onHeightChange(clampedHeight)
        onWidthChange(newWidth)
      } else {
        const clamped = clamp(newHeight, minHeight, maxHeight)
        setInternalHeight(clamped)
        onHeightChange(clamped)
      }
    },
    [
      isLocked,
      aspectRatio,
      getDimensionRange,
      onHeightChange,
      onWidthChange,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
    ],
  )

  const handleAspectRatioChange = useCallback(
    (newRatio: number) => {
      onAspectRatioChange(newRatio)

      const newHeight = clamp(
        getHeightFromWidth(internalWidth, newRatio),
        minHeight,
        maxHeight,
      )
      const newWidth = clamp(
        getWidthFromHeight(internalHeight, newRatio),
        minWidth,
        maxWidth,
      )

      setInternalHeight(newHeight)
      setInternalWidth(newWidth)

      onHeightChange(newHeight)
      onWidthChange(newWidth)
    },
    [
      internalWidth,
      internalHeight,
      onAspectRatioChange,
      onHeightChange,
      onWidthChange,
      minHeight,
      maxHeight,
      minWidth,
      maxWidth,
    ],
  )

  const handleLockToggle = useCallback(
    (checked: boolean) => {
      setIsLocked(checked)
      onAspectRatioChange(checked ? calculateAspectRatio(width, height) : undefined)
    },
    [width, height, onAspectRatioChange],
  )

  useEffect(() => {
    if (aspectRatio !== undefined) {
      if (!isLocked) setIsLocked(true)
      const newHeight = clamp(getHeightFromWidth(width, aspectRatio), minHeight, maxHeight)
      setInternalHeight(newHeight)
      onHeightChange(newHeight)
    }
  }, [
    aspectRatio,
    isLocked,
    width,
    getHeightFromWidth,
    onHeightChange,
    minHeight,
    maxHeight,
  ])

  const {
    minWidth: effectiveMinW,
    maxWidth: effectiveMaxW,
    minHeight: effectiveMinH,
    maxHeight: effectiveMaxH,
  } = getDimensionRange(aspectRatio)

  return (
    <>
      <InputNumber
        value={internalWidth}
        onChange={handleWidthChange}
        min={effectiveMinW}
        max={effectiveMaxW}
        step={1}
        disabled={disabled}
      >
        Columns
      </InputNumber>
      <InputNumber
        value={internalHeight}
        onChange={handleHeightChange}
        min={effectiveMinH}
        max={effectiveMaxH}
        step={1}
        disabled={disabled}
      >
        Rows
      </InputNumber>

      <InputSwitch
        checked={useRatio}
        onChange={(checked) => {
          setUseRatio(checked)
          if (onAspectRatioFromImgChange) {
            onAspectRatioFromImgChange(checked)
          }
        }}
      >
        Use Image Aspect Ratio
      </InputSwitch>
      <InputSwitch
        checked={isLocked}
        onChange={handleLockToggle}
        disabled={disabled || useRatio}
      >
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
            disabled={disabled || useRatio}
            showSlider={false}
          >
            Aspect Ratio
          </InputNumber>
        </div>
      )}
    </>
  )
}
