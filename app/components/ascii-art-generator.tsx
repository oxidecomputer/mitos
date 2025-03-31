import { useDebounce } from '@uidotdev/usehooks'
import { decompressFrames, parseGIF } from 'gifuct-js'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AsciiPreview, type AnimationController } from '~/components/ascii-preview'
import { ExportOptions } from '~/components/export-options'
import {
  OutputConfiguration,
  predefinedCharacterSets,
} from '~/components/output-configuration'
import { PreprocessingControls } from '~/components/preprocessing-controls'
import { ProjectManagement } from '~/components/project-management'
import { SourceSelector } from '~/components/source-selector'
import type { Program } from '~/lib/animation'
import { createCodeAsciiProgram, createImageAsciiProgram } from '~/lib/ascii-program'
import {
  processAnimatedMedia,
  processCodeModule,
  processImage,
  type CachedMediaData,
} from '~/lib/image-processor'

import { AnimationOptions } from './animation-options'
import { CodeSidebar } from './code-sidebar'

export type SourceType = 'image' | 'code' | 'gif' | 'video'
export type GridType = 'none' | 'horizontal' | 'vertical' | 'both'

export interface AsciiSettings {
  source: {
    type: SourceType
    data: string | null
    code: string
  }
  preprocessing: {
    brightness: number
    whitePoint: number
    blackPoint: number
    blur: number
    invert: boolean
    dithering: boolean
    ditheringAlgorithm: 'floydSteinberg' | 'atkinson' | 'ordered' | 'bayer'
  }
  output: {
    characterSet: string
    grid: GridType
    showUnderlyingImage: boolean
    columns: number
    rows: number
    aspectRatio?: number
  }
  animation: {
    animationLength: number
    frameRate: number
  }
}

const DEFAULT_CODE = `const density = 'Ñ@#W$9876543210?!abc;:+=-,._ ';

// Renders each cell
function main(coord, context, cursor, buffer) {
  // To generate output, return a single character
  // or an object with a "char" field, for example {char: 'x'}
  const {cols, frame} = context;
  const {x, y} = coord;

  // Calculate an index into the density string
  const sign = y % 2 * 2 - 1;
  const index = (cols + y + x * sign + frame) % density.length;

  return density[index];
}

// Optional: Runs once at startup
function boot(context, buffer, userData) {}

// Optional: Runs at the start of each frame
function pre(context, cursor, buffer, userData) {}

// Optional: Runs after each frame is complete
function post(context, cursor, buffer, userData) {}`

const DEFAULT_SETTINGS: AsciiSettings = {
  source: {
    type: 'image',
    data: null,
    code: DEFAULT_CODE,
  },
  preprocessing: {
    brightness: 0,
    whitePoint: 255,
    blackPoint: 0,
    blur: 0,
    invert: false,
    dithering: false,
    ditheringAlgorithm: 'floydSteinberg',
  },
  output: {
    characterSet: predefinedCharacterSets['light'],
    grid: 'both',
    showUnderlyingImage: false,
    columns: 80,
    rows: 40,
    aspectRatio: 0.5,
  },
  animation: {
    animationLength: 100,
    frameRate: 30,
  },
}

export function AsciiArtGenerator() {
  // Core state
  const [settings, setSettings] = useState<AsciiSettings>(DEFAULT_SETTINGS)
  const debouncedSettings = useDebounce(settings, 300)

  const [program, setProgram] = useState<Program | null>(null)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [animationController, setAnimationController] = useState<AnimationController>(null)

  // Processing state
  const [isExporting, setIsExporting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [cachedMedia, setCachedMedia] = useState<CachedMediaData | null>(null)
  const [showCodeSidebar, setShowCodeSidebar] = useState(false)

  // Process ASCII data when settings change
  useEffect(() => {
    const processContent = async () => {
      if (!settings.source.data && settings.source.type !== 'code') return

      setIsProcessing(true)
      setProgram(null)

      try {
        const columns = settings.output.columns || 80
        const rows = settings.output.rows || 40

        switch (settings.source.type) {
          case 'image':
            if (settings.source.data) {
              await processStaticImage(settings.source.data, columns, rows)
            }
            break
          case 'gif':
          case 'video':
            if (settings.source.data) {
              await processAnimatedSource(
                settings.source.type,
                settings.source.data,
                columns,
                rows,
              )
            }
            break
          case 'code':
            await processCodeSource(columns, rows)
            break
        }
      } catch (error) {
        console.error('Error processing:', error)
        toast(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setIsProcessing(false)
      }
    }

    processContent()
  }, [debouncedSettings])

  // Process a static image source
  const processStaticImage = async (imageData: string, columns: number, rows: number) => {
    setIsProcessing(true)

    try {
      const result = await processImage(imageData, settings)

      if (result.processedImageUrl) {
        setProcessedImageUrl(result.processedImageUrl)
      }

      const newProgram = await createImageAsciiProgram(result.data, columns, rows)
      setProgram(newProgram)
    } finally {
      setIsProcessing(false)
    }
  }

  // Process an animated source (GIF or video)
  const processAnimatedSource = async (
    sourceType: 'gif' | 'video',
    sourceData: string,
    columns: number,
    rows: number,
  ) => {
    // Check if we can use cached media data
    const canReuseCache =
      cachedMedia && cachedMedia.type === sourceType && cachedMedia.sourceUrl === sourceData

    if (canReuseCache) {
      const processingSettingsChanged = haveProcessingSettingsChanged(cachedMedia)

      if (processingSettingsChanged) {
        // Settings have changed, reprocess the cached raw frames
        await reprocessCachedFrames(cachedMedia, columns, rows)
      } else {
        // Settings haven't changed, use existing processed frames
        await useCachedFrames(cachedMedia, sourceType, columns, rows)
      }
    } else {
      // No cache or different source - need to extract and process frames
      if (sourceType === 'gif') {
        await processGifSource(sourceData, columns, rows)
      } else {
        await processVideoSource(sourceData, columns, rows)
      }
    }
  }

  // Check if processing settings have changed requiring reprocessing
  const haveProcessingSettingsChanged = (cache: CachedMediaData) => {
    if (!cache.processedFrames) return true

    const { settings: cachedSettings } = cache.processedFrames
    const { output, preprocessing } = settings

    return (
      cachedSettings.columns !== output.columns ||
      cachedSettings.rows !== output.rows ||
      cachedSettings.characterSet !== output.characterSet ||
      cachedSettings.whitePoint !== preprocessing.whitePoint ||
      cachedSettings.blackPoint !== preprocessing.blackPoint ||
      cachedSettings.brightness !== preprocessing.brightness ||
      cachedSettings.invert !== preprocessing.invert ||
      cachedSettings.dithering !== preprocessing.dithering ||
      cachedSettings.ditheringAlgorithm !== preprocessing.ditheringAlgorithm
    )
  }

  // Reprocess cached frames with new settings
  const reprocessCachedFrames = async (
    cache: CachedMediaData,
    columns: number,
    rows: number,
  ) => {
    setIsProcessing(true)
    toast('Applying new visual settings...')

    try {
      const result = await processAnimatedMedia(cache.rawFrames, settings, (progress) => {
        if (progress % 5 === 0 || progress === cache.rawFrames.length - 1) {
          toast(`Processing frame ${progress + 1} of ${cache.rawFrames.length}...`)
        }
      })

      // Update cache with newly processed frames
      updateMediaCache(cache, result.frames)
      setProcessedImageUrl(result.firstFrameUrl || null)

      // Create program with newly processed frames
      const newProgram = await createImageAsciiProgram(
        result.firstFrameData,
        columns,
        rows,
        result.frames,
        settings.animation.frameRate,
      )

      setProgram(newProgram)

      toast(`Reprocessed ${result.frames.length} frames with new settings`)
    } catch (error) {
      handleProcessingError('reprocessing', error)
    }
  }

  // Update the media cache with new processed frames
  const updateMediaCache = useCallback(
    (cache: CachedMediaData, frames: any[]) => {
      setCachedMedia({
        ...cache,
        processedFrames: {
          settings: {
            columns: settings.output.columns,
            rows: settings.output.rows,
            characterSet: settings.output.characterSet,
            whitePoint: settings.preprocessing.whitePoint,
            blackPoint: settings.preprocessing.blackPoint,
            brightness: settings.preprocessing.brightness,
            invert: settings.preprocessing.invert,
            dithering: settings.preprocessing.dithering,
            ditheringAlgorithm: settings.preprocessing.ditheringAlgorithm,
          },
          frames,
        },
      })
    },
    [settings],
  )

  // Use cached frames without reprocessing
  const useCachedFrames = async (
    cache: CachedMediaData,
    mediaType: 'gif' | 'video',
    columns: number,
    rows: number,
  ) => {
    toast('Applying cached frames...')

    try {
      // Use cached frames directly
      const processedFrames = cache.processedFrames!.frames

      // Create program with cached frames
      const newProgram = await createImageAsciiProgram(
        processedFrames[0], // First frame
        columns,
        rows,
        processedFrames,
        settings.animation.frameRate,
      )

      // Set the first frame as preview
      if (cache.rawFrames.length > 0) {
        setProcessedImageUrl(cache.rawFrames[0].dataUrl)
      }

      setProgram(newProgram)

      toast(`Loaded ${processedFrames.length} frames from cache`)
    } catch (error) {
      handleProcessingError('loading cached', error)

      // If using cached frames fails, try reprocessing
      if (mediaType === 'gif') {
        await processGifSource(cache.sourceUrl, columns, rows)
      } else {
        await processVideoSource(cache.sourceUrl, columns, rows)
      }
    }
  }

  // Process GIF source using gifuct-js
  const processGifSource = async (gifData: string, columns: number, rows: number) => {
    toast('Reading GIF structure...')

    try {
      // Convert data URL to binary data
      const bytes = dataUrlToUint8Array(gifData)

      // Parse the GIF and extract frames
      const gif = parseGIF(bytes)
      const frames = decompressFrames(gif, true)

      toast(`Found ${frames.length} frames. Processing...`)

      if (frames.length === 0) {
        throw new Error('No frames found in GIF')
      }

      // Extract frames as data URLs
      const rawFrames = await extractGifFrames(gif, frames)

      // Process all extracted frames
      const result = await processAnimatedMedia(rawFrames, settings, (progress) => {
        if (progress % 5 === 0 || progress === rawFrames.length - 1) {
          toast(`Processing frame ${progress + 1} of ${rawFrames.length}...`)
        }
      })

      // Create cache entry
      setCachedMedia({
        type: 'gif',
        sourceUrl: gifData,
        rawFrames,
        processedFrames: {
          settings: {
            columns: settings.output.columns,
            rows: settings.output.rows,
            characterSet: settings.output.characterSet,
            whitePoint: settings.preprocessing.whitePoint,
            blackPoint: settings.preprocessing.blackPoint,
            brightness: settings.preprocessing.brightness,
            invert: settings.preprocessing.invert,
            dithering: settings.preprocessing.dithering,
            ditheringAlgorithm: settings.preprocessing.ditheringAlgorithm,
          },
          frames: result.frames,
        },
      })

      // Set preview
      setProcessedImageUrl(result.firstFrameUrl)

      // Create animated program
      const newProgram = await createImageAsciiProgram(
        result.firstFrameData,
        columns,
        rows,
        result.frames,
        settings.animation.frameRate,
      )

      setProgram(newProgram)
      updateAnimationLength(result.frames.length)

      toast(`Processed ${result.frames.length} frames`)
    } catch (error) {
      handleProcessingError('processing', error)
    }
  }

  // Process video source (simplified as this would use the browser's video processing)
  const processVideoSource = async (videoData: string, columns: number, rows: number) => {
    try {
      const result = await processImage(videoData, settings, true)

      if (result.processedImageUrl) {
        setProcessedImageUrl(result.processedImageUrl)
      }

      if (result.rawFrames && result.frames) {
        // Cache the extracted frames
        setCachedMedia({
          type: 'video',
          sourceUrl: videoData,
          rawFrames: result.rawFrames,
          processedFrames: {
            settings: {
              columns: settings.output.columns,
              rows: settings.output.rows,
              characterSet: settings.output.characterSet,
              whitePoint: settings.preprocessing.whitePoint,
              blackPoint: settings.preprocessing.blackPoint,
              brightness: settings.preprocessing.brightness,
              invert: settings.preprocessing.invert,
              dithering: settings.preprocessing.dithering,
              ditheringAlgorithm: settings.preprocessing.ditheringAlgorithm,
            },
            frames: result.frames,
          },
        })
      }

      // Create animated program
      const newProgram = await createImageAsciiProgram(
        result.data,
        columns,
        rows,
        result.frames || [],
        settings.animation.frameRate,
      )

      setProgram(newProgram)

      if (result.frames) {
        updateAnimationLength(result.frames.length)
      }
    } catch (error) {
      handleProcessingError('processing', error)
    }
  }

  // Process code source
  const processCodeSource = async (columns: number, rows: number) => {
    const module = processCodeModule(settings.source.code)
    if (!module) {
      toast('Could not process your code. Check for syntax errors.')
      return
    }

    const newProgram = await createCodeAsciiProgram(
      columns,
      rows,
      settings.animation.frameRate,
      module,
    )

    setProgram(newProgram)
  }

  // Helper functions
  const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
    const base64Data = dataUrl.split(',')[1]
    const binaryString = window.atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return bytes
  }

  const extractGifFrames = async (
    gif: any,
    frames: any[],
  ): Promise<{ dataUrl: string; timestamp?: number }[]> => {
    const { width, height } = gif.lsd
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) throw new Error('Could not get canvas context')

    canvas.width = width
    canvas.height = height

    // Create off-screen canvas for frame composition
    const offscreenCanvas = document.createElement('canvas')
    const offscreenCtx = offscreenCanvas.getContext('2d')

    if (!offscreenCtx) throw new Error('Could not get offscreen canvas context')

    offscreenCanvas.width = width
    offscreenCanvas.height = height

    // Extract frames
    const rawFrames: { dataUrl: string; timestamp?: number }[] = []
    let previousImageData: ImageData | null = null

    for (let i = 0; i < frames.length; i++) {
      // Update progress periodically
      if (i % 5 === 0 || i === frames.length - 1) {
        toast(`Processing frame ${i + 1} of ${frames.length}...`)
      }

      const frame = frames[i]

      // Handle disposal from previous frame
      if (i > 0) {
        const prevFrame = frames[i - 1]

        if (prevFrame.disposalType === 2) {
          // Clear previous frame area only
          ctx.clearRect(
            prevFrame.dims.left,
            prevFrame.dims.top,
            prevFrame.dims.width,
            prevFrame.dims.height,
          )
        } else if (prevFrame.disposalType === 3 && previousImageData) {
          // Restore to previous state
          ctx.putImageData(previousImageData, 0, 0)
        }
      }

      // Save state if we need to restore to this later
      if (frame.disposalType === 3) {
        previousImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      }

      // Prepare frame patch on offscreen canvas
      const frameImageData = offscreenCtx.createImageData(
        frame.dims.width,
        frame.dims.height,
      )
      frameImageData.data.set(frame.patch)
      offscreenCtx.putImageData(frameImageData, 0, 0)

      // Draw the patch onto the main canvas at the correct position
      ctx.drawImage(
        offscreenCanvas,
        0,
        0,
        frame.dims.width,
        frame.dims.height,
        frame.dims.left,
        frame.dims.top,
        frame.dims.width,
        frame.dims.height,
      )

      // Capture the full frame
      const frameDataUrl = canvas.toDataURL('image/png')

      // Store the frame data
      rawFrames.push({
        dataUrl: frameDataUrl,
        timestamp: frame.delay,
      })
    }

    return rawFrames
  }

  const handleProcessingError = (operation: string, error: any) => {
    console.error(`Error ${operation}:`, error)
    toast(
      error instanceof Error ? error.message : `Could not process. Try a different asset.`,
    )
  }

  const updateAnimationLength = (length: number) => {
    setSettings((prev) => ({
      ...prev,
      animation: {
        ...prev.animation,
        animationLength: length,
      },
    }))
  }

  // Settings update functions
  const updateSettings = (newSettings: Partial<AsciiSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }))
  }

  const updateSourceSettings = (sourceSettings: Partial<typeof settings.source>) => {
    setSettings((prev) => {
      // If switching source type, reset program to ensure clean transition
      if (sourceSettings.type && sourceSettings.type !== prev.source.type) {
        setProgram(null)
        setProcessedImageUrl(null)
        setCachedMedia(null)
        // Reset animation controller to ensure clean state
        setAnimationController(null)
      }

      return {
        ...prev,
        source: {
          ...prev.source,
          ...sourceSettings,
        },
      }
    })
  }

  const updatePreprocessingSettings = (
    preprocessingSettings: Partial<typeof settings.preprocessing>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      preprocessing: {
        ...prev.preprocessing,
        ...preprocessingSettings,
      },
    }))
  }

  const updateOutputSettings = (outputSettings: Partial<typeof settings.output>) => {
    setSettings((prev) => ({
      ...prev,
      output: {
        ...prev.output,
        ...outputSettings,
      },
    }))
  }

  const updateAnimationSettings = (
    animationSettings: Partial<typeof settings.animation>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      animation: {
        ...prev.animation,
        ...animationSettings,
      },
    }))
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="left-0 top-0 flex h-full w-64 transform flex-col overflow-hidden border-r bg-background">
        {/* Source Selection Tabs */}
        <SourceSelector settings={settings.source} updateSettings={updateSourceSettings} />
        <div className="overflow-auto">
          <div className="space-y-6 py-4">
            {/* Preprocessing (for non-code sources) */}
            {settings.source.type !== 'code' && (
              <PreprocessingControls
                settings={settings.preprocessing}
                updateSettings={updatePreprocessingSettings}
              />
            )}

            <hr />

            {/* Output Configuration */}
            <OutputConfiguration
              settings={settings.output}
              updateSettings={updateOutputSettings}
              sourceType={settings.source.type}
            />

            {/* Animation Options (for animated content) */}
            {(settings.source.type === 'code' ||
              settings.source.type === 'gif' ||
              settings.source.type === 'video') && (
              <>
                <hr />
                <AnimationOptions
                  settings={settings.animation}
                  updateSettings={updateAnimationSettings}
                  sourceType={settings.source.type}
                />
              </>
            )}

            <hr />

            {/* Export Options */}
            <ExportOptions
              program={program}
              sourceType={settings.source.type}
              animationController={animationController}
              animationLength={settings.animation.animationLength}
              isExporting={isExporting}
              setIsExporting={setIsExporting}
              dimensions={{
                width: settings.output.columns,
                height: settings.output.rows,
              }}
              disabled={!program}
            />

            <hr />

            {/* Project Management */}
            <ProjectManagement settings={settings} updateSettings={updateSettings} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* ASCII Preview */}
          <div className="flex-grow overflow-hidden bg-white">
            <AsciiPreview
              program={program}
              dimensions={{
                width: settings.output.columns,
                height: settings.output.rows,
              }}
              sourceType={settings.source.type}
              gridType={settings.output.grid}
              showUnderlyingImage={settings.output.showUnderlyingImage}
              underlyingImageUrl={processedImageUrl || settings.source.data}
              settings={settings.animation}
              animationController={animationController}
              setAnimationController={setAnimationController}
              isExporting={isExporting}
              isProcessing={isProcessing}
            />
          </div>

          {/* Code Sidebar */}
          <CodeSidebar
            settings={settings.source}
            updateSettings={updateSourceSettings}
            isOpen={showCodeSidebar}
            setShowCodeSidebar={setShowCodeSidebar}
          />
        </div>
      </div>
    </div>
  )
}
