import { decompressFrames, parseGIF } from 'gifuct-js'
import { useCallback, useRef, useState } from 'react'
import * as R from 'remeda'
import { toast } from 'sonner'

import { AsciiPreview, type AnimationController } from '~/components/ascii-preview'
import { ExportOptions } from '~/components/export-options'
import {
  OutputConfiguration,
  predefinedCharacterSets,
} from '~/components/output-configuration'
import { PreprocessingControls } from '~/components/preprocessing-controls'
// import { ProjectManagement } from '~/components/project-management'
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

const DEFAULT_CODE = `/**
@author ertdfgcvb
@url https://play.ertdfgcvb.xyz/#/src/basics/coordinates_xy
*/

const density = 'Ñ@#W$9876543210?!abc;:+=-,._ ';

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
  },
  animation: {
    animationLength: 100,
    frameRate: 30,
  },
}

export function AsciiArtGenerator() {
  // Core state
  const [settings, setSettings] = useState<AsciiSettings>(DEFAULT_SETTINGS)

  const [program, setProgram] = useState<Program | null>(null)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [animationController, setAnimationController] = useState<AnimationController>(null)

  // Processing state
  const [isExporting, setIsExporting] = useState(false)
  const [_, setIsProcessing] = useState(false) // Keeping this in case its useful later
  const [cachedMedia, setCachedMedia] = useState<CachedMediaData | null>(null)
  const [showCodeSidebar, setShowCodeSidebar] = useState(false)

  const processingQueue = useRef<{
    pending: boolean
    settings: AsciiSettings | null
    lastProcessedSettings: AsciiSettings | null
  }>({
    pending: false,
    settings: null,
    lastProcessedSettings: null,
  })

  const processStaticImage = async (
    imageData: string,
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    setIsProcessing(true)

    try {
      const result = await processImage(imageData, currentSettings)

      if (result.processedImageUrl) {
        setProcessedImageUrl(result.processedImageUrl)
      }

      const newProgram = await createImageAsciiProgram(result.data, columns, rows)
      setProgram(newProgram)
    } finally {
      setIsProcessing(false)
    }
  }

  const processAnimatedSource = async (
    sourceType: 'gif' | 'video',
    sourceData: string,
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    // Check if we can use cached media data
    const canReuseCache =
      cachedMedia && cachedMedia.type === sourceType && cachedMedia.sourceUrl === sourceData

    if (canReuseCache) {
      const processingSettingsChanged = haveProcessingSettingsChanged(
        cachedMedia,
        currentSettings,
      )

      if (processingSettingsChanged) {
        // Settings have changed, reprocess the cached raw frames
        await reprocessCachedFrames(cachedMedia, columns, rows, currentSettings)
      } else {
        // Settings haven't changed, use existing processed frames
        await useCachedFrames(cachedMedia, columns, rows, currentSettings)
      }
    } else {
      await processGifSource(sourceData, columns, rows, currentSettings)
    }
  }

  const processCodeSource = async (
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    const module = processCodeModule(currentSettings.source.code)
    if (!module) {
      toast('Could not process your code. Check for syntax errors.')
      return
    }

    const newProgram = await createCodeAsciiProgram(
      columns,
      rows,
      currentSettings.animation.frameRate,
      module,
    )

    setProgram(newProgram)
  }

  // Process ASCII data when settings change
  const queueProcessing = useCallback(
    (newSettings: AsciiSettings) => {
      const queue = processingQueue.current

      queue.settings = newSettings

      if (queue.pending) return

      // Start processing if not already in progress
      const processNext = async () => {
        const currentQueue = processingQueue.current

        if (!currentQueue.settings) return

        const settingsToProcess = currentQueue.settings

        // Skip processing if settings haven't meaningfully changed
        if (
          currentQueue.lastProcessedSettings &&
          R.isDeepEqual(
            getRelevantSettings(currentQueue.lastProcessedSettings),
            getRelevantSettings(settingsToProcess),
          )
        ) {
          currentQueue.pending = false
          currentQueue.settings = null
          return
        }

        currentQueue.pending = true
        currentQueue.settings = null
        setIsProcessing(true)

        try {
          // Process based on source type
          const { source, output } = settingsToProcess
          const columns = output.columns
          const rows = output.rows

          if (!source.data && source.type !== 'code') {
            currentQueue.pending = false
            setIsProcessing(false)
            return
          }

          switch (source.type) {
            case 'image':
              if (source.data) {
                await processStaticImage(source.data, columns, rows, newSettings)
              }
              break
            case 'gif':
            case 'video':
              if (source.data) {
                await processAnimatedSource(
                  source.type,
                  source.data,
                  columns,
                  rows,
                  newSettings,
                )
              }
              break
            case 'code':
              await processCodeSource(columns, rows, newSettings)
              break
          }

          // Store the processed settings
          currentQueue.lastProcessedSettings = structuredClone(settingsToProcess)
        } catch (error) {
          console.error('Error processing:', error)
          toast(error instanceof Error ? error.message : 'Unknown error')
        } finally {
          // Mark processing as complete
          currentQueue.pending = false
          setIsProcessing(false)

          // If new settings arrived during processing, process them next
          if (currentQueue.settings) {
            processNext()
          }
        }
      }

      // Start processing
      processNext()
    },
    [processStaticImage, processAnimatedSource, processCodeSource, setIsProcessing],
  )

  const getRelevantSettings = (settings: AsciiSettings) => {
    const { source, preprocessing, output } = settings

    // For code sources, we only care about the code and dimensions
    if (source.type === 'code') {
      return {
        sourceType: source.type,
        code: source.code,
        columns: output.columns,
        rows: output.rows,
      }
    }

    // For other sources, return relevant processing settings
    return {
      sourceType: source.type,
      sourceData: source.data,
      preprocessing,
      columns: output.columns,
      rows: output.rows,
      characterSet: output.characterSet,
    }
  }

  // Check if processing settings have changed requiring reprocessing
  const haveProcessingSettingsChanged = (
    cache: CachedMediaData,
    currentSettings: AsciiSettings,
  ) => {
    if (!cache.processedFrames) return true

    const { settings: cachedSettings } = cache.processedFrames
    const { output, preprocessing } = currentSettings

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
    currentSettings: AsciiSettings,
  ) => {
    setIsProcessing(true)

    const reprocessingPromise = new Promise<{ frames: number }>(async (resolve, reject) => {
      try {
        const result = await processAnimatedMedia(cache.rawFrames, currentSettings)

        // Update cache with newly processed frames
        updateMediaCache(cache, result.frames, currentSettings)
        setProcessedImageUrl(result.firstFrameUrl || null)

        // Create program with newly processed frames
        const newProgram = await createImageAsciiProgram(
          result.firstFrameData,
          columns,
          rows,
          result.frames,
          currentSettings.animation.frameRate,
        )

        setProgram(newProgram)

        resolve({ frames: result.frames.length })
      } catch (error) {
        reject(error)
      }
    })

    // Show a promise-based toast that updates its state
    toast.promise(reprocessingPromise, {
      loading: 'Applying new visual settings...',
      success: (data) => `Reprocessed ${data.frames} frames with new settings`,
      error: (error) =>
        `Error: ${error instanceof Error ? error.message : 'Could not apply settings'}`,
    })

    try {
      await reprocessingPromise
    } finally {
      setIsProcessing(false)
    }
  }

  // Update the media cache with new processed frames
  const updateMediaCache = (
    cache: CachedMediaData,
    frames: any[],
    currentSettings: AsciiSettings,
  ) => {
    setCachedMedia({
      ...cache,
      processedFrames: {
        settings: {
          columns: currentSettings.output.columns,
          rows: currentSettings.output.rows,
          characterSet: currentSettings.output.characterSet,
          whitePoint: currentSettings.preprocessing.whitePoint,
          blackPoint: currentSettings.preprocessing.blackPoint,
          brightness: currentSettings.preprocessing.brightness,
          invert: currentSettings.preprocessing.invert,
          dithering: currentSettings.preprocessing.dithering,
          ditheringAlgorithm: currentSettings.preprocessing.ditheringAlgorithm,
        },
        frames,
      },
    })
  }

  // Use cached frames without reprocessing
  const useCachedFrames = async (
    cache: CachedMediaData,
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
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
        currentSettings.animation.frameRate,
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
      await processGifSource(cache.sourceUrl, columns, rows, currentSettings)
    }
  }

  // Process GIF source using gifuct-js
  const processGifSource = async (
    gifData: string,
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    const processingPromise = new Promise(async (resolve, reject) => {
      try {
        // Convert data URL to binary data
        const bytes = dataUrlToUint8Array(gifData)

        // Parse the GIF and extract frames
        const gif = parseGIF(bytes)
        const frames = decompressFrames(gif, true)

        if (frames.length === 0) {
          throw new Error('No frames found in GIF')
        }

        // Extract frames as data URLs
        const rawFrames = await extractGifFrames(gif, frames)

        // Process all extracted frames
        const result = await processAnimatedMedia(rawFrames, currentSettings)

        // Create cache entry
        setCachedMedia({
          type: 'gif',
          sourceUrl: gifData,
          rawFrames,
          processedFrames: {
            settings: {
              columns: currentSettings.output.columns,
              rows: currentSettings.output.rows,
              characterSet: currentSettings.output.characterSet,
              whitePoint: currentSettings.preprocessing.whitePoint,
              blackPoint: currentSettings.preprocessing.blackPoint,
              brightness: currentSettings.preprocessing.brightness,
              invert: currentSettings.preprocessing.invert,
              dithering: currentSettings.preprocessing.dithering,
              ditheringAlgorithm: currentSettings.preprocessing.ditheringAlgorithm,
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
          currentSettings.animation.frameRate,
        )

        setProgram(newProgram)
        updateSettings('animation', { animationLength: result.frames.length })

        resolve({
          frames: result.frames.length,
        })
      } catch (error) {
        reject(error)
      }
    })

    toast.promise(processingPromise, {
      loading: 'Processing GIF frames...',
      success: (data) => `Processed ${(data as any).frames} frames successfully`,
      error: (error) =>
        `Error: ${error instanceof Error ? error.message : 'Could not process GIF'}`,
    })

    try {
      await processingPromise
    } finally {
      setIsProcessing(false)
    }
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
      // No need for progress toasts here

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

  const updateSettings = <K extends keyof AsciiSettings>(
    section: K,
    newValues: Partial<AsciiSettings[K]>,
  ) => {
    setSettings((prev) => {
      // Handle special case for source type changes
      if (
        section === 'source' &&
        'type' in newValues &&
        newValues.type !== prev.source.type
      ) {
        setProgram(null)
        setProcessedImageUrl(null)
        setCachedMedia(null)

        if (animationController) {
          setAnimationController(null)
        }

        // Reset processing queue
        processingQueue.current = {
          pending: false,
          settings: null,
          lastProcessedSettings: null,
        }
      }

      const newSettings = {
        ...prev,
        [section]: {
          ...prev[section],
          ...newValues,
        },
      }

      queueProcessing(newSettings)
      return newSettings
    })
  }
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="left-0 top-0 flex h-full w-64 transform flex-col overflow-hidden border-r bg-raise border-default">
        {/* Source Selection Tabs */}
        <SourceSelector
          settings={settings.source}
          updateSettings={(changes) => updateSettings('source', changes)}
          showCodeSidebar={showCodeSidebar}
          setShowCodeSidebar={setShowCodeSidebar}
        />
        <div className="overflow-auto">
          <div className="space-y-6 py-4">
            {/* Preprocessing (for non-code sources) */}
            {settings.source.type !== 'code' && (
              <>
                <PreprocessingControls
                  settings={settings.preprocessing}
                  updateSettings={(changes) => updateSettings('preprocessing', changes)}
                />
                <hr />
              </>
            )}

            {/* Output Configuration */}
            <OutputConfiguration
              settings={settings.output}
              updateSettings={(changes) => updateSettings('output', changes)}
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
                  updateSettings={(changes) => updateSettings('animation', changes)}
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

            {/* <hr /> */}
            {/* Project Management */}
            {/* <ProjectManagement settings={settings} updateSettings={updateSettings} /> */}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* ASCII Preview */}
          <div className="flex-grow overflow-hidden bg-default">
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
            />
          </div>

          {/* Code Sidebar */}
          <CodeSidebar
            settings={settings.source}
            updateSettings={(changes) => updateSettings('source', changes)}
            isOpen={showCodeSidebar}
          />
        </div>
      </div>
    </div>
  )
}
