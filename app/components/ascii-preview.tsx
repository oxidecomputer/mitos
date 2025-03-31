import { Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { createAnimation, Program } from '~/lib/animation'
import { InputButton, InputNumber } from '~/lib/ui/src'

import AsciiAnimation from './ascii-animation'
import type { GridType, SourceType } from './ascii-art-generator'
import { GridOverlay } from './grid-overlay'

interface AsciiPreviewProps {
  program: Program | null
  dimensions: { width: number; height: number }
  sourceType: SourceType
  gridType: GridType
  showUnderlyingImage: boolean
  underlyingImageUrl: string | null
  settings: {
    animationLength: number
    frameRate: number
  }
  animationController: AnimationController
  setAnimationController: (controller: AnimationController) => void
  isExporting: boolean
  isProcessing?: boolean
}

export type AnimationController = ReturnType<typeof createAnimation> | null

export function AsciiPreview({
  program,
  dimensions,
  sourceType,
  gridType,
  showUnderlyingImage,
  underlyingImageUrl,
  settings,
  animationController,
  setAnimationController,
  isExporting,
  isProcessing = false,
}: AsciiPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [frame, setFrame] = useState(0)

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 5))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
  }

  if (!program) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">
          {sourceType === 'image'
            ? `Upload an image to see the ASCII preview`
            : 'Enter code to see the ASCII preview'}
        </p>
      </div>
    )
  }

  const cols = dimensions.width
  const rows = dimensions.height

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Zoom controls */}
      {program && (
        <div className="absolute left-2 top-2 z-30 flex items-center gap-2 rounded-md bg-white/80 p-2 shadow-sm backdrop-blur-sm">
          <InputButton
            variant="secondary"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </InputButton>

          <InputNumber
            showSlider={false}
            value={zoomLevel}
            min={0.5}
            max={5}
            step={0.25}
            onChange={setZoomLevel}
            formatOptions={{ style: 'percent' }}
          />

          <InputButton variant="secondary" onClick={handleZoomIn} disabled={zoomLevel >= 5}>
            <ZoomIn className="h-4 w-4" />
          </InputButton>

          <InputButton
            variant="secondary"
            onClick={handleResetZoom}
            disabled={zoomLevel === 1}
          >
            <RotateCcw className="h-4 w-4" />
          </InputButton>
        </div>
      )}

      {/* ASCII preview container */}
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-auto"
      >
        {(isExporting || isProcessing) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="rounded-md bg-white p-4 text-center shadow-xl">
              <div className="mb-2 text-lg font-semibold">
                {isExporting ? 'Exporting Frames' : 'Processing Media'}
              </div>
              <div className="text-sm text-muted-foreground">
                Please wait, this may take a moment...
              </div>
            </div>
          </div>
        )}
        <div
          className="relative transform-gpu transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Show underlying image if enabled */}
          {showUnderlyingImage && underlyingImageUrl && program && (
            <div className="absolute inset-0 z-0">
              <img
                src={underlyingImageUrl || '/placeholder.svg'}
                alt="Source image"
                className="h-full w-full object-fill [image-rendering:pixelated]"
              />
            </div>
          )}

          {/* ASCII animation */}
          <div className="relative z-20 [font-size:0px]">
            <AsciiAnimation
              program={program}
              onFrameUpdate={setFrame}
              maxFrames={settings.animationLength}
              animationController={animationController}
              setAnimationController={setAnimationController}
            />

            {gridType !== 'none' && program && (
              <GridOverlay grid={gridType} cols={cols} rows={rows} />
            )}
          </div>
        </div>
      </div>

      {(sourceType === 'code' || sourceType === 'gif' || sourceType === 'video') && (
        <FrameSlider
          frame={frame}
          totalFrames={settings.animationLength}
          animationController={animationController}
          sourceType={sourceType}
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
  sourceType,
}: {
  frame: number
  totalFrames: number
  animationController: AnimationController
  sourceType?: SourceType
}) {
  const [playing, setPlaying] = useState(false)

  const togglePlay = () => {
    if (animationController && !playing) {
      setPlaying(true)
      animationController.togglePlay(true)
    } else {
      setPlaying(false)
      animationController?.togglePlay(false)
    }
  }

  // Reset frame when source type changes
  useEffect(() => {
    if (animationController) {
      animationController.setFrame(0)
    }
  }, [sourceType, animationController])

  return (
    <div className="absolute bottom-2 left-2 right-2 z-30 flex flex-col gap-2 rounded-md bg-white/80 p-2 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InputButton onClick={togglePlay}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </InputButton>
        </div>

        <span className="text-xs text-muted-foreground">
          {frame} / {totalFrames}
        </span>
      </div>
      <InputNumber
        value={frame}
        min={0}
        max={totalFrames}
        step={1}
        onChange={(value) => animationController && animationController.setFrame(value)}
      />
    </div>
  )
}
