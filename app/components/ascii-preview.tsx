/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import {
  Action16Icon,
  AutoRestart12Icon,
  DirectionRightIcon,
  DocumentApi16Icon,
  Folder16Icon,
  Resize16Icon,
} from '@oxide/design-system/icons/react'
import useResizeObserver from '@react-hook/resize-observer'
import { motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import type { createAnimation, Program } from '~/lib/animation'
import { InputButton, InputNumber } from '~/lib/ui/src'

import AsciiAnimation from './ascii-animation'
import type { GridType } from './ascii-art-generator'
import { calculateContentDimensions } from './dimension-utils'
import { GridOverlay } from './grid-overlay'

interface AsciiPreviewProps {
  program: Program | null
  dimensions: { width: number; height: number }
  gridType: GridType
  showUnderlyingImage: boolean
  underlyingImageUrl: string | null
  settings: {
    animationLength: number
    frameRate: number
    textColor: string
    backgroundColor: string
    padding: number
  }
  animationController: AnimationController
  setAnimationController: (controller: AnimationController) => void
  isExporting: boolean
  onUploadClick?: () => void
  onExampleScriptClick?: () => void
  onExampleImageClick?: () => void
}

export type AnimationController = ReturnType<typeof createAnimation> | null

const DemoCard = ({
  icon,
  title,
  onClick,
  index,
}: {
  icon: React.ReactNode
  title: string
  onClick?: () => void
  index: number
}) => (
  <motion.button
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      duration: 0.5,
      delay: index * 0.1,
      ease: [0.25, 0.46, 0.45, 0.94],
    }}
    className="flex w-[20rem] items-center rounded border p-2 text-left transition-colors bg-raise border-secondary elevation-1 hover:bg-[var(--base-neutral-100)]"
    onClick={onClick}
  >
    <div className="mr-3 inline-flex items-center justify-center rounded p-2 text-accent bg-accent-secondary">
      {icon}
    </div>
    <div className="text-default text-sans-md">{title}</div>
  </motion.button>
)

const useSize = (target: HTMLDivElement | null) => {
  const [size, setSize] = useState<DOMRect | undefined>()

  useLayoutEffect(() => {
    if (target) {
      setSize(target.getBoundingClientRect())
    }
  }, [target])

  useResizeObserver(target, (entry) => setSize(entry.contentRect))
  return size
}

export function AsciiPreview({
  program,
  dimensions,
  gridType,
  showUnderlyingImage,
  underlyingImageUrl,
  settings,
  animationController,
  setAnimationController,
  isExporting,
  onExampleScriptClick,
  onExampleImageClick,
}: AsciiPreviewProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [frame, setFrame] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [autoFit, setAutoFit] = useState(false)
  const prevDimensionsRef = useRef(dimensions)

  const containerSize = useSize(container)

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    setAutoFit(false)

    const zoomFactor = 0.035 * (e.deltaY > 0 ? 1 : 1.1)

    if (e.deltaY < 0) {
      setZoomLevel((prev) => Math.min(prev * (1 + zoomFactor), 5))
    } else {
      setZoomLevel((prev) => Math.max(prev / (1 + zoomFactor), 0.5))
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y
        setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
        setDragStart({ x: e.clientX, y: e.clientY })
      }
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleResetView = () => {
    setZoomLevel(1)
    setPosition({ x: 0, y: 0 })
    setAutoFit(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, handleMouseMove, handleMouseUp])

  useEffect(() => {
    if (autoFit && program && containerSize) {
      const { totalWidth, totalHeight } = calculateContentDimensions(
        dimensions,
        settings.padding,
      )

      const scaleX = containerSize.width / totalWidth
      const scaleY = containerSize.height / totalHeight

      const newZoom = Math.min(scaleX, scaleY) * 0.9 // 90% to leave some margin

      setZoomLevel(newZoom)
      setPosition({ x: 0, y: 0 })
    }
  }, [autoFit, dimensions, program, containerSize, settings.padding])

  useEffect(() => {
    if (
      autoFit &&
      (dimensions.width !== prevDimensionsRef.current.width ||
        dimensions.height !== prevDimensionsRef.current.height)
    ) {
      prevDimensionsRef.current = dimensions
    }
  }, [dimensions, autoFit])

  // shift+2 auto fits canvas
  useHotkeys('shift+2', () => setAutoFit(true), [])

  if (!program) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col gap-3 p-8">
          <DemoCard
            index={0}
            icon={<Folder16Icon className="text-accent-secondary" />}
            title="Upload image or GIF"
            onClick={() => {
              const fileInput = document.querySelector(
                'input[type="file"]',
              ) as HTMLInputElement
              if (fileInput) {
                fileInput.click()
              }
            }}
          />
          <DemoCard
            index={1}
            icon={<DocumentApi16Icon className="text-accent-secondary" />}
            title="Run example script"
            onClick={onExampleScriptClick}
          />
          <DemoCard
            index={2}
            icon={<Action16Icon className="text-accent-secondary" />}
            title="Use example image"
            onClick={onExampleImageClick}
          />
        </div>
      </div>
    )
  }

  const cols = dimensions.width
  const rows = dimensions.height

  const paddingPixels = calculateContentDimensions(
    dimensions,
    settings.padding,
  ).paddingPixels

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Zoom controls */}
      {program && (
        <div className="absolute right-2 top-2 z-30 flex gap-2">
          <div className="flex items-center gap-1 rounded-md border p-2 bg-raise border-default">
            <InputNumber
              showSlider={false}
              value={zoomLevel}
              min={0.5}
              max={5}
              step={0.25}
              onChange={setZoomLevel}
              formatOptions={{ style: 'percent' }}
            />

            <InputButton
              variant="secondary"
              icon
              className="!h-6"
              onClick={handleResetView}
              disabled={zoomLevel === 1 && position.x === 0 && position.y === 0}
            >
              <AutoRestart12Icon className="rotate-90 -scale-x-100" />
            </InputButton>

            <InputButton
              variant={autoFit ? 'default' : 'secondary'}
              icon
              className="!h-6"
              onClick={() => setAutoFit(!autoFit)}
            >
              <Resize16Icon className="w-3" />
            </InputButton>
          </div>
        </div>
      )}
      {/* ASCII preview container */}
      <div
        ref={setContainer}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="relative flex flex-1 items-center justify-center overflow-auto"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {isExporting && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="rounded-md border p-4 text-center bg-default border-default elevation-2">
              <div className="mb-2 text-lg font-semibold text-raise">Exporting Frames</div>
              <div className="text-muted-foreground text-sm">
                Please wait, this may take a moment...
              </div>
            </div>
          </div>
        )}
        <div
          className="duration-50 relative transform-gpu transition-transform ease-out"
          style={{
            transform: isExporting
              ? 'none'
              : `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          {/* ASCII animation */}
          <div className="relative z-20 [font-size:0px]">
            <AsciiAnimation
              program={program}
              onFrameUpdate={setFrame}
              maxFrames={settings.animationLength}
              animationController={animationController}
              setAnimationController={setAnimationController}
              textColor={settings.textColor}
              backgroundColor={settings.backgroundColor}
              padding={paddingPixels}
            >
              {/* Show underlying image if enabled */}
              {showUnderlyingImage && underlyingImageUrl && !isExporting && program && (
                <div
                  className="pointer-events-none absolute inset-0 z-0"
                  style={{ padding: paddingPixels }}
                >
                  <img
                    src={underlyingImageUrl}
                    alt="Source image"
                    className="h-full w-full object-fill [image-rendering:pixelated]"
                  />
                </div>
              )}
            </AsciiAnimation>

            {gridType !== 'none' && program && (
              <GridOverlay
                grid={gridType}
                cols={cols}
                rows={rows}
                padding={
                  calculateContentDimensions(dimensions, settings.padding).paddingPixels
                }
              />
            )}
          </div>
        </div>
      </div>
      {settings.animationLength > 1 && (
        <FrameSlider
          frame={frame}
          totalFrames={settings.animationLength}
          animationController={animationController}
        />
      )}
    </div>
  )
}

export const getContent = (dimensions: { width: number; height: number }) => {
  const asciiElement = document.querySelector('.ascii-animation pre')

  if (asciiElement) {
    const rawContent = asciiElement.textContent || ''
    const { width, height } = dimensions

    // Process the raw content into properly formatted lines
    const formattedLines = []

    for (let i = 0; i < height; i++) {
      // Extract exactly width characters for each line
      const lineStart = i * width
      const lineEnd = lineStart + width

      // Ensure we don't go out of bounds
      if (lineStart < rawContent.length) {
        const line = rawContent.substring(lineStart, Math.min(lineEnd, rawContent.length))
        // Add the line without right trimming to preserve spaces
        formattedLines.push(line)
      }
    }

    // Join the lines with newlines
    return formattedLines.join('\n')
  }
}

function FrameSlider({
  frame,
  totalFrames,
  animationController,
}: {
  frame: number
  totalFrames: number
  animationController: AnimationController
}) {
  const [playing, setPlaying] = useState(
    animationController && animationController.getState().playing ? true : false,
  )

  const togglePlay = () => {
    if (animationController) {
      const newPlayState = !playing
      animationController.togglePlay(newPlayState)
      setPlaying(newPlayState)
    }
  }

  useEffect(() => {
    if (animationController) {
      setPlaying(animationController.getState().playing)
    }
  }, [animationController])

  // Reset frame when source type changes
  useEffect(() => {
    if (animationController) {
      const wasPlaying = animationController.getState().playing

      animationController.setFrame(0)

      // Restore play state
      if (wasPlaying) {
        animationController.togglePlay(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="absolute bottom-2 left-2 right-2 z-30 flex flex-col gap-2 rounded-md border p-2 bg-raise border-default">
      <div className="flex items-center gap-2">
        <InputButton onClick={togglePlay} inline>
          {playing ? <Pause12 /> : <DirectionRightIcon />}
        </InputButton>
        <InputNumber
          value={frame}
          min={0}
          max={totalFrames - 1}
          step={1}
          onChange={(value) => animationController && animationController.setFrame(value)}
          className="grow"
        />
      </div>
    </div>
  )
}

export const Pause12 = ({ className }: { className?: string }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.67 2C3.29997 2 3 2.29997 3 2.67V9.33C3 9.70003 3.29997 10 3.67 10H4.33C4.70003 10 5 9.70003 5 9.33V2.67C5 2.29997 4.70003 2 4.33 2H3.67ZM7.67 2C7.29997 2 7 2.29997 7 2.67V9.33C7 9.70003 7.29997 10 7.67 10H8.33C8.70003 10 9 9.70003 9 9.33V2.67C9 2.29997 8.70003 2 8.33 2H7.67Z"
      fill="currentColor"
    />
  </svg>
)
