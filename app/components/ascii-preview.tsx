import { Copy, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Slider } from '~/components/ui/slider'
import { useToast } from '~/components/ui/use-toast'
import type { createAnimation, Program } from '~/lib/animation'

import AsciiAnimation from './ascii-animation'
import type { SourceType } from './ascii-art-generator'
import { GridOverlay } from './grid-overlay'

interface AsciiPreviewProps {
  program: Program | null
  dimensions: { width: number; height: number }
  sourceType: SourceType
  gridType: 'none' | 'horizontal' | 'vertical' | 'both'
  showUnderlyingImage: boolean
  underlyingImageUrl: string | null
  settings: {
    animationLength: number
    frameRate: number
    loop: 'once' | 'infinite'
  }
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
}: AsciiPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [zoomLevel, setZoomLevel] = useState(1)
  const [frame, setFrame] = useState(0)

  const [animationController, setAnimationController] = useState<AnimationController>(null)

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 5))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
  }

  const handleZoomChange = (value: number[]) => {
    setZoomLevel(value[0])
  }

  // Convert ASCII data to text with line breaks and copy to clipboard
  // Adds line breaks based on column width

  const copyToClipboard = () => {
    if (!program) return

    try {
      const asciiElement = document.querySelector('.ascii-animation pre')
      let asciiText = ''

      if (asciiElement) {
        const content = asciiElement.textContent || ''

        const { width } = dimensions
        let processed = ''

        for (let i = 0; i < content.length; i++) {
          processed += content[i]

          if ((i + 1) % width === 0 && i < content.length - 1) {
            processed += '\n'
          }
        }

        asciiText = processed
          .split('\n')
          .map((line) => line.trimRight())
          .join('\n')
      } else {
        throw new Error('No ASCII content available')
      }

      navigator.clipboard.writeText(asciiText).then(() => {
        toast({
          title: 'Copied to clipboard',
          description: 'ASCII art has been copied to your clipboard',
        })
      })
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      })
    }
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
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <div className="w-32 px-2">
            <Slider
              value={[zoomLevel]}
              min={0.5}
              max={5}
              step={0.25}
              onValueChange={handleZoomChange}
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleResetZoom}
            disabled={zoomLevel === 1}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <span className="ml-1 text-xs font-medium">{Math.round(zoomLevel * 100)}%</span>

          <div className="ml-2 h-5 border-r border-gray-300"></div>

          <Button
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            title="Copy ASCII to clipboard"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ASCII preview container */}
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-auto"
      >
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

      <FrameSlider
        frame={frame}
        totalFrames={settings.animationLength}
        animationController={animationController}
      />
    </div>
  )
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

  return (
    <div className="absolute bottom-2 left-2 right-2 z-30 flex flex-col gap-2 rounded-md bg-white/80 p-2 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={togglePlay}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>

        <span className="text-xs text-muted-foreground">
          {frame} / {totalFrames}
        </span>
      </div>
      <Slider
        value={[frame]}
        min={1}
        max={totalFrames}
        step={1}
        onValueChange={(value) =>
          animationController && animationController.setFrame(value[0])
        }
      />
    </div>
  )
}
