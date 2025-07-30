/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import * as esbuild from 'esbuild-wasm'
import { decompressFrames, ParsedFrame, ParsedGif, parseGIF } from 'gifuct-js'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as R from 'remeda'
import { toast } from 'sonner'

import { AsciiPreview, type AnimationController } from '~/components/ascii-preview'
import { AssetExport } from '~/components/asset-export'
import { ExportOptions } from '~/components/export-options'
import { OutputOptions } from '~/components/output-options'
import { PreprocessingOptions } from '~/components/preprocessing-options'
import { SourceSelector } from '~/components/source-selector'
import type { Data, Program } from '~/lib/animation'
import { createCodeAsciiProgram, createImageAsciiProgram } from '~/lib/ascii-program'
import { processCodeModule } from '~/lib/code-processor'
import {
  DitheringAlgorithm,
  processAnimatedMedia,
  processImage,
  type CachedMediaData,
} from '~/lib/image-processor'
import { cn } from '~/lib/utils'
import { DEFAULT_SETTINGS, exampleImage, TEMPLATES, TemplateType } from '~/templates'

import { AnimationOptions } from './animation-options'
import { CodeSidebar } from './code-sidebar'
import { ProjectManagement } from './project-management'

// Use window global to track esbuild initialization across hot reloads and StrictMode
declare global {
  interface Window {
    esbuildInitialized?: boolean
  }
}

export type SourceType = 'image' | 'code' | 'gif'
export type GridType = 'none' | 'horizontal' | 'vertical' | 'both'
export type ColorMappingType = 'brightness' | 'hue' | 'saturation'

export interface AsciiSettings {
  meta: {
    name: string
  }
  source: {
    type: SourceType
    data: string | null
    code: string
    imageDimensions?: { width: number; height: number }
  }
  preprocessing: {
    brightness: number
    whitePoint: number
    blackPoint: number
    blur: number
    invert: boolean
    dithering: boolean
    ditheringAlgorithm: DitheringAlgorithm
  }
  output: {
    characterSet: string
    grid: GridType
    showUnderlyingImage: boolean
    columns: number
    rows: number
    aspectRatio?: number
    useImageAspectRatio: boolean
    colorMapping: ColorMappingType
  }
  export: {
    textColor: string
    backgroundColor: string
    padding: number
  }
  animation: {
    animationLength: number
    frameRate: number
  }
}

export type EsbuildService = typeof esbuild

export function AsciiArtGenerator() {
  // Core state
  const [settings, setSettings] = useState<AsciiSettings>(DEFAULT_SETTINGS)
  const [program, setProgram] = useState<Program | null>(null)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [animationController, setAnimationController] = useState<AnimationController>(null)
  const [dragActive, setDragActive] = useState(false)
  const [pendingCode, setPendingCode] = useState(settings.source.code)
  const [projectName, setProjectName] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType | ''>('')

  // Processing state
  const [isExporting, setIsExporting] = useState(false)
  const [_isProcessing, setIsProcessing] = useState(false)
  const [cachedMedia, setCachedMedia] = useState<CachedMediaData | null>(null)
  const [showCodeSidebar, setShowCodeSidebar] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  const lastProcessedSettings = useRef<AsciiSettings | null>(null)
  const isInitialMount = useRef(true)
  const esbuildService = useRef<EsbuildService>(null)

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    // Trigger the warning dialog when the user closes or navigates the tab
    event.preventDefault()
  }

  // Helper function to load a template
  const loadTemplate = useCallback(
    (template: TemplateType) => {
      setTemplateType(template)
      setSettings(TEMPLATES[template] as AsciiSettings)
      setProjectName(TEMPLATES[template].meta.name)

      if (TEMPLATES[template].source.code) {
        setPendingCode(TEMPLATES[template].source.code)
        // Auto-open code sidebar if it's not already open and template has code
        if (!showCodeSidebar) {
          setShowCodeSidebar(true)
        }
      }

      toast(`Applied "${TEMPLATES[template].meta.name}" template`)

      // Remove template parameter from URL after loading template
      const url = new URL(window.location.href)
      url.searchParams.delete('template')
      window.history.replaceState({}, '', url.toString())
    },
    [showCodeSidebar],
  )

  // Initialize esbuild service
  useEffect(() => {
    const startService = async () => {
      if (!window.esbuildInitialized) {
        try {
          window.esbuildInitialized = true
          await esbuild.initialize({
            wasmURL: 'https://unpkg.com/esbuild-wasm/esbuild.wasm',
          })
          esbuildService.current = esbuild
        } catch (error) {
          console.error('Failed to initialize esbuild:', error)
        }
      } else {
        esbuildService.current = esbuild
      }
    }
    startService()
  }, [])

  // Load template from URL parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const templateParam = urlParams.get('template')

    if (templateParam && templateParam in TEMPLATES) {
      const template = templateParam as TemplateType
      loadTemplate(template)
    }
    // only need to run on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Check if the user has loaded some media or modified the code
    const isSourceDirty =
      (settings.source.type !== 'code' && settings.source.data !== null) ||
      pendingCode !== DEFAULT_SETTINGS.source.code

    if (isSourceDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [settings, pendingCode])

  useEffect(() => {
    // Skip processing on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Check if settings have meaningfully changed
    if (
      lastProcessedSettings.current &&
      R.isDeepEqual(
        getRelevantSettings(lastProcessedSettings.current),
        getRelevantSettings(settings),
      )
    ) {
      return
    }

    // Process the current settings
    processCurrentSettings()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const getRelevantSettings = (settings: AsciiSettings) => {
    const { source, preprocessing, output, animation } = settings

    // For code sources, we only care about the code and dimensions
    if (source.type === 'code') {
      return {
        sourceType: source.type,
        code: source.code,
        columns: output.columns,
        rows: output.rows,
        frameRate: animation.frameRate,
      }
    }

    return {
      sourceType: source.type,
      sourceData: source.data,
      preprocessing,
      columns: output.columns,
      rows: output.rows,
      frameRate: animation.frameRate,
      characterSet: output.characterSet,
      colorMapping: output.colorMapping,
    }
  }

  const processCurrentSettings = async () => {
    if (!settings.source.data && settings.source.type !== 'code') {
      return
    }

    setIsProcessing(true)

    try {
      const { source, output } = settings
      const columns = output.columns
      const rows = output.rows

      switch (source.type) {
        case 'image':
          if (source.data) {
            await processStaticImage(source.data, columns, rows, settings)
          }
          break
        case 'gif':
          if (source.data) {
            await processAnimatedSource(source.type, source.data, columns, rows, settings)
          }
          break
        case 'code':
          await processCodeSource(columns, rows, settings)
          break
      }

      lastProcessedSettings.current = structuredClone(settings)
    } catch (error) {
      console.error('Error processing:', error)
      toast(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsProcessing(false)
    }
  }

  const processStaticImage = async (
    imageData: string,
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    try {
      const result = await processImage(imageData, currentSettings)

      if (result.processedImageUrl) {
        setProcessedImageUrl(result.processedImageUrl)
      }

      const newProgram = await createImageAsciiProgram(result.data, columns, rows)
      setProgram(newProgram)
    } catch (error) {
      handleProcessingError('processing image', error)
    }
  }

  const processAnimatedSource = async (
    sourceType: 'gif',
    sourceData: string,
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    const canReuseCache =
      cachedMedia && cachedMedia.type === sourceType && cachedMedia.sourceUrl === sourceData

    try {
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
          await reuseExistingFrames(cachedMedia, columns, rows, currentSettings)
        }
      } else {
        await processGifSource(sourceData, columns, rows, currentSettings)
      }
    } catch (error) {
      handleProcessingError('processing animated source', error)
    }
  }

  const processCodeSource = async (
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    try {
      if (!esbuildService.current) {
        toast('Code processor not ready. Please try again.')
        return
      }

      // Check if code contains import statements for unpkg support
      const hasImports = /^\s*import\s+/m.test(currentSettings.source.code)

      const result = await processCodeModule(currentSettings.source.code, {
        esbuildService: esbuildService.current,
        timeout: 5000,
        allowUnpkgImports: hasImports,
      })

      if (!result.success || !result.module) {
        toast(result.error || 'Could not process your code. Check for syntax errors.')
        return
      }

      const newProgram = await createCodeAsciiProgram(
        columns,
        rows,
        currentSettings.animation.frameRate,
        result.module,
      )

      setProgram(newProgram)
    } catch (error) {
      handleProcessingError('processing code', error)
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
      cachedSettings.colorMapping !== output.colorMapping ||
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
    const processFrames = async (): Promise<{ frames: number }> => {
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
      return { frames: result.frames.length }
    }

    // Show a promise-based toast that updates its state
    toast.promise(processFrames(), {
      loading: 'Applying new visual settings...',
      success: (data) => `Reprocessed ${data.frames} frames with new settings`,
      error: (error) =>
        `Error: ${error instanceof Error ? error.message : 'Could not apply settings'}`,
    })
  }

  // Update the media cache with new processed frames
  const updateMediaCache = (
    cache: CachedMediaData,
    frames: Data[],
    currentSettings: AsciiSettings,
  ) => {
    setCachedMedia({
      ...cache,
      processedFrames: {
        settings: {
          columns: currentSettings.output.columns,
          rows: currentSettings.output.rows,
          characterSet: currentSettings.output.characterSet,
          colorMapping: currentSettings.output.colorMapping,
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
  const reuseExistingFrames = async (
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
    const processGif = async (): Promise<{ frames: number }> => {
      // Convert data URL to binary data
      const bytes = dataUrlToUint8Array(gifData)

      // Parse the GIF and extract frames
      // Fix type issue by creating proper ArrayBuffer
      const buffer = bytes.buffer
      const gif = parseGIF(buffer)
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
            colorMapping: currentSettings.output.colorMapping,
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

      return { frames: result.frames.length }
    }

    toast.promise(processGif(), {
      loading: 'Processing GIF frames...',
      success: (data) => `Processed ${data.frames} frames successfully`,
      error: (error) =>
        `Error: ${error instanceof Error ? error.message : 'Could not process GIF'}`,
    })
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
    gif: ParsedGif,
    frames: ParsedFrame[],
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

  const handleProcessingError = (operation: string, error: unknown) => {
    console.error(`Error ${operation}:`, error)
    toast(
      error instanceof Error ? error.message : `Could not process. Try a different asset.`,
    )
  }

  const updateSettings = useCallback(
    <K extends keyof AsciiSettings>(section: K, newValues: Partial<AsciiSettings[K]>) => {
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

          // Reset last processed settings
          lastProcessedSettings.current = null
        }

        return {
          ...prev,
          [section]: {
            ...prev[section],
            ...newValues,
          },
        }
      })
    },
    [animationController],
  )

  const setAspectRatioFromImage = (
    imageUrl: string,
  ): Promise<{ aspectRatio: number; width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        // Calculate the image aspect ratio
        const aspectRatio = img.width / img.height
        resolve({ aspectRatio, width: img.width, height: img.height })
      }
      img.src = imageUrl
    })
  }

  // Helper to update both source and aspect ratio in a single batch update
  const updateSourceAndAspectRatio = async (imageUrl: string, type: 'image' | 'gif') => {
    const { aspectRatio, width, height } = await setAspectRatioFromImage(imageUrl)

    // Update all settings at once to avoid race conditions
    setSettings((prev) => ({
      ...prev,
      source: {
        ...prev.source,
        data: imageUrl,
        type,
        imageDimensions: { width, height }, // Store dimensions with source
      },
      output: {
        ...prev.output,
        aspectRatio: prev.output.useImageAspectRatio
          ? aspectRatio
          : prev.output.aspectRatio,
      },
    }))

    setShowCodeSidebar(false)
    return true
  }

  const processFile = useCallback(
    (file: File, dataUrl?: string): boolean => {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
      const validGifTypes = ['image/gif']
      const validJsonType = 'application/json'

      if (file.type === validJsonType || file.name.endsWith('.json')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          handleLoadProject(result)
        }
        reader.readAsText(file)
        return true
      } else if (validGifTypes.includes(file.type) || validImageTypes.includes(file.type)) {
        // Determine type ('gif' or 'image')
        const sourceType = validGifTypes.includes(file.type) ? 'gif' : 'image'

        if (dataUrl) {
          // If we already have the dataUrl (from paste preview)
          updateSourceAndAspectRatio(dataUrl, sourceType)
          return true
        } else {
          // Read the file to get dataUrl
          const reader = new FileReader()
          reader.onload = (e) => {
            const result = e.target?.result as string
            updateSourceAndAspectRatio(result, sourceType)
          }
          reader.readAsDataURL(file)
          return true
        }
      } else {
        toast('Please upload an image (JPG, PNG, WEBP, AVIF) or a GIF file.')
        return false
      }
    },
    [updateSourceAndAspectRatio],
  )

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleCodeProjectLoaded = useCallback((code: string) => {
    setPendingCode(code)
    setShowCodeSidebar(true)
  }, [])

  const handleLoadProjectInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0])
      }
    },
    [processFile],
  )

  const handleExampleScriptClick = useCallback(() => {
    // Open code sidebar and load the clock example
    setShowCodeSidebar(true)
    const defaultTemplate = TEMPLATES.default
    setPendingCode(defaultTemplate.source.code)
    updateSettings('source', {
      type: 'code',
      data: null,
      code: defaultTemplate.source.code,
    })
    updateSettings('output', defaultTemplate.output)
    updateSettings('animation', defaultTemplate.animation)
  }, [updateSettings])

  const handleTemplateChange = (template: TemplateType) => {
    if (template !== 'custom' && TEMPLATES[template]) {
      loadTemplate(template)
    } else if (template === 'custom') {
      setTemplateType(template)
    }
  }

  const handleLoadProject = (json: string) => {
    console.log(json)
    try {
      const projectData = JSON.parse(json)
      setProjectName(projectData.name || 'Imported Project')

      if (projectData.settings) {
        setSettings(projectData.settings as AsciiSettings)

        // If the imported project is a code project, show the code sidebar
        if (projectData.settings.source.type === 'code') {
          // Pass this information up to the parent
          handleCodeProjectLoaded(projectData.settings.source.code)
        }
      }

      // Set template type to custom since we loaded a saved project
      setTemplateType('custom')

      toast(`${projectData.name} has been loaded successfully.`)
    } catch (_error) {
      toast('The selected file is not a valid project file')
    }
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: showSidebar ? 256 : 0 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
        className="left-0 top-0 transform overflow-hidden border-r bg-raise border-default"
        style={{ minWidth: 0 }}
      >
        <motion.div
          animate={{ opacity: showSidebar ? 1 : 0 }}
          transition={{ duration: showSidebar ? 0.3 : 0.1 }}
          className="pointer-events-auto flex h-full flex-col"
          style={{
            width: 256,
            pointerEvents: showSidebar ? 'auto' : 'none',
          }}
        >
          <div className="flex items-center justify-center rounded px-4 py-3 text-center font-mono text-default [font-size:12px] [&>*]:border-y [&>*]:border-r [&>*]:px-1 [&>*]:py-0.5 [&>*]:border-default">
            <div className="rounded-l border-l">M</div>
            <div>I</div>
            <div>T</div>
            <div>O</div>
            <div className="rounded-r">S</div>
          </div>

          <hr />

          {/* Source Selection Tabs */}
          <SourceSelector
            settings={settings.source}
            showCodeSidebar={showCodeSidebar}
            setShowCodeSidebar={setShowCodeSidebar}
            processFile={processFile}
          />
          <div className="flex grow flex-col justify-between overflow-auto">
            <div className="space-y-6 py-4">
              {/* Preprocessing (for non-code sources) */}
              {settings.source.type !== 'code' && (
                <>
                  <PreprocessingOptions
                    settings={settings.preprocessing}
                    updateSettings={(changes) => updateSettings('preprocessing', changes)}
                  />
                  <hr />
                </>
              )}
              {/* Output Options */}
              <OutputOptions
                settings={settings.output}
                updateSettings={(changes) => updateSettings('output', changes)}
                sourceType={settings.source.type}
                sourceImageDimensions={settings.source.imageDimensions}
              />
              {/* Animation Options (for animated content) */}
              {(settings.source.type === 'code' || settings.source.type === 'gif') && (
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
                settings={settings.export}
                updateSettings={(changes) => updateSettings('export', changes)}
              />
              <hr />
              {/* Asset Export */}
              <AssetExport
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
                exportSettings={settings.export}
              />
              <hr />
              {/* Project Management */}
              <ProjectManagement
                projectName={projectName}
                setProjectName={setProjectName}
                templateType={templateType}
                settings={settings}
                handleLoadProjectInput={handleLoadProjectInput}
                handleTemplateChange={handleTemplateChange}
              />
            </div>
            <div className="flex grow items-end p-3 pb-2">
              <a
                href="https://oxide.computer"
                target="_blank"
                className="flex items-center gap-2 font-mono uppercase text-quaternary [font-size:12px]"
              >
                /*
                <div className="link-with-underline text-secondary">Made by Oxide</div>
                */
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="absolute left-4 top-3 z-30">
        <button
          className={cn(
            '-m-2 rounded border p-2 transition-transform bg-raise hover:bg-hover',
            showSidebar ? 'border-transparent' : 'border-[--mt-border]',
          )}
          onClick={() => setShowSidebar(!showSidebar)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M1 0.75C1 0.335786 1.33579 0 1.75 0H10.25C10.6642 0 11 0.335786 11 0.75V11.25C11 11.6642 10.6642 12 10.25 12H1.75C1.33579 12 1 11.6642 1 11.25V0.75ZM7.25 1.5H9C9.27614 1.5 9.5 1.72386 9.5 2V10C9.5 10.2761 9.27614 10.5 9 10.5H7.25V1.5ZM6.25 1.5H4V10.5H6.25V1.5Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* ASCII Preview */}
          <div
            className={cn(
              'relative flex-1 overflow-hidden',
              dragActive ? 'bg-secondary' : 'bg-default',
            )}
          >
            {dragActive && (
              <div className="absolute inset-1 rounded border border-dashed border-accent-secondary" />
            )}
            <AsciiPreview
              key={settings.source.type}
              program={program}
              dimensions={{
                width: settings.output.columns,
                height: settings.output.rows,
              }}
              sourceType={settings.source.type}
              gridType={settings.output.grid}
              showUnderlyingImage={settings.output.showUnderlyingImage}
              underlyingImageUrl={processedImageUrl || settings.source.data}
              settings={{ ...settings.animation, ...settings.export }}
              animationController={animationController}
              setAnimationController={setAnimationController}
              isExporting={isExporting}
              onExampleScriptClick={handleExampleScriptClick}
              onExampleImageClick={() => updateSourceAndAspectRatio(exampleImage, 'image')}
            />
          </div>

          {/* Code Sidebar */}
          <CodeSidebar
            pendingCode={pendingCode}
            setPendingCode={setPendingCode}
            updateSettings={(changes) => updateSettings('source', changes)}
            isOpen={showCodeSidebar}
          />
        </div>
      </div>
    </div>
  )
}

export const TreeNodeEnd = ({ className }: { className?: string }) => (
  <svg
    width="16"
    height="8"
    viewBox="0 0 16 8"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1 2H0V7V8H1H16V7H1V2Z"
      fill="currentColor"
    />
  </svg>
)
