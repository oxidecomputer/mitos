/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

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
import { useEsbuild } from '~/hooks/use-esbuild'
import type { Program } from '~/lib/animation'
import { createProgramFromProcessor, generateImageCode } from '~/lib/ascii-program'
import { processCodeModule } from '~/lib/code-processor'
import {
  DitheringAlgorithm,
  processAnimatedMedia,
  processImage,
} from '~/lib/image-processor'
import type { AsciiImageData } from '~/lib/types'
import { cn } from '~/lib/utils'
import {
  DEFAULT_CODE,
  DEFAULT_SETTINGS,
  exampleImage,
  TEMPLATES,
  TemplateType,
} from '~/templates'

import { AnimationOptions } from './animation-options'
import { CodeSidebar } from './code-sidebar'
import { ProjectManagement } from './project-management'

export type GridType = 'none' | 'horizontal' | 'vertical' | 'both'
export type ColorMappingType = 'brightness' | 'hue' | 'saturation'

export interface AsciiSettings {
  meta: {
    name: string
  }
  source: {
    data: string | null
    code: string
    fileName: string
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

export function AsciiArtGenerator() {
  // Core state
  const [settings, setSettings] = useState<AsciiSettings>(DEFAULT_SETTINGS)
  const [program, setProgram] = useState<Program | null>(null)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [animationController, setAnimationController] = useState<AnimationController>(null)
  const [dragActive, setDragActive] = useState(false)
  const [pendingCode, setPendingCode] = useState('')
  const [projectName, setProjectName] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType | ''>('')
  const [currentImageData, setCurrentImageData] = useState<AsciiImageData | null>(null)
  const [currentFrames, setCurrentFrames] = useState<AsciiImageData[] | null>(null)

  // Processing state
  const [isExporting, setIsExporting] = useState(false)
  const [_isProcessing, setIsProcessing] = useState(false)
  const [showCodeSidebar, setShowCodeSidebar] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  const prevSettings = useRef<AsciiSettings | null>(null)
  const isInitialMount = useRef(true)

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

      // Clear image source state when loading templates
      setCurrentImageData(null)
      setCurrentFrames(null)

      toast(`Applied "${TEMPLATES[template].meta.name}" template`)

      // Remove template parameter from URL after loading template
      const url = new URL(window.location.href)
      url.searchParams.delete('template')
      window.history.replaceState({}, '', url.toString())
    },
    [showCodeSidebar],
  )

  const {
    esbuildService,
    isInitialized: esbuildInitialized,
    isInitializing: esbuildInitializing,
  } = useEsbuild()

  // Load template from URL parameter on mount
  useEffect(() => {
    if (!esbuildInitialized || esbuildInitializing) return

    const urlParams = new URLSearchParams(window.location.search)
    const templateParam = urlParams.get('template')

    if (templateParam && templateParam in TEMPLATES) {
      const template = templateParam as TemplateType
      loadTemplate(template)
    }
    // only need to run on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esbuildInitialized, esbuildInitializing])

  useEffect(() => {
    // Check if the user has loaded some media or modified the code
    const isSourceDirty = settings.source.data !== null || pendingCode !== ''

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
      prevSettings.current &&
      R.isDeepEqual(
        getRelevantSettings(prevSettings.current),
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

    return {
      sourceData: source.data,
      code: source.code,
      preprocessing,
      columns: output.columns,
      rows: output.rows,
      frameRate: animation.frameRate,
      characterSet: output.characterSet,
      colorMapping: output.colorMapping,
    }
  }

  const processCurrentSettings = async () => {
    if (!settings.source.data && !settings.source.code) {
      return
    }
    try {
      const columns = settings.output.columns
      const rows = settings.output.rows

      const shouldProcess =
        prevSettings && prevSettings.current
          ? haveProcessingSettingsChanged(prevSettings.current, settings)
          : true

      if (shouldProcess && settings.source.data) {
        if (settings.source.data.includes('data:image/gif')) {
          await processGifSource(settings.source.data, settings)
        } else {
          await processStaticImage(settings.source.data, settings)
        }
      }

      await processCodeSource(columns, rows, settings)
    } catch (error) {
      console.error('Error processing:', error)
      toast(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsProcessing(false)
    }
  }

  const processStaticImage = async (imageData: string, currentSettings: AsciiSettings) => {
    try {
      const result = await processImage(imageData, currentSettings)

      if (result.processedImageUrl) {
        setProcessedImageUrl(result.processedImageUrl)
      }

      setCurrentImageData(result.data)
      setCurrentFrames(null)

      // Only generate initial code if pendingCode is empty
      if (pendingCode === '') {
        const code = generateImageCode()
        setPendingCode(code)
        updateSettings('source', { code })
      }
    } catch (error) {
      handleProcessingError('processing image', error)
    }
  }

  // Process GIF source using gifuct-js
  const processGifSource = async (gifData: string, currentSettings: AsciiSettings) => {
    if (!esbuildService || !esbuildInitialized) {
      if (esbuildInitializing) {
        toast('Code processor is still initializing. Please wait a moment.')
      } else {
        toast('Code processor not ready. Please try again.')
      }
      return
    }

    const processGif = async (): Promise<{ frames: number }> => {
      // Convert data URL to binary data
      const bytes = dataUrlToUint8Array(gifData)

      // Parse the GIF and extract frames
      // Fix type issue by creating proper ArrayBuffer
      const buffer = bytes.buffer as ArrayBuffer
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
      prevSettings.current = currentSettings

      // Set preview
      setProcessedImageUrl(result.firstFrameUrl)

      setCurrentImageData(result.firstFrameData)
      setCurrentFrames(result.frames)
      if (pendingCode === '') {
        const code = generateImageCode()
        setPendingCode(code)
        updateSettings('source', { code })
      }
      // Only update animation length if it's different to prevent infinite loop
      if (currentSettings.animation.animationLength !== result.frames.length) {
        updateSettings('animation', { animationLength: result.frames.length })
      }

      return { frames: result.frames.length }
    }

    toast.promise(processGif(), {
      loading: 'Processing GIF frames...',
      success: (data) => `Processed ${data.frames} frames successfully`,
      error: (error) =>
        `Error: ${error instanceof Error ? error.message : 'Could not process GIF'}`,
    })
  }

  const processCodeSource = async (
    columns: number,
    rows: number,
    currentSettings: AsciiSettings,
  ) => {
    try {
      if (!esbuildService || !esbuildInitialized) {
        if (esbuildInitializing) {
          toast('Code processor is still initializing. Please wait a moment.')
        } else {
          toast('Code processor not ready. Please try again.')
        }
        return
      }

      const result = await processCodeModule(currentSettings.source.code, {
        esbuildService: esbuildService,
        timeout: 5000,
        imageData: currentImageData,
        frames: currentFrames || undefined,
        settings: currentSettings,
      })

      if (!result.success || !result.module) {
        toast(result.error || 'Could not process your code. Check for syntax errors.')
        return
      }

      const newProgram = await createProgramFromProcessor(result, {
        width: columns,
        height: rows,
        frameRate: currentSettings.animation.frameRate,
      })

      setProgram(newProgram)
    } catch (error) {
      handleProcessingError('processing code', error)
    }
  }

  // Check if processing settings have changed requiring reprocessing
  const haveProcessingSettingsChanged = (
    lastProcessedSettings: AsciiSettings,
    currentSettings: AsciiSettings,
  ) => {
    const { output, preprocessing } = currentSettings
    const { output: prevOutput, preprocessing: prevPreprocessing } = lastProcessedSettings

    return (
      prevOutput.columns !== output.columns ||
      prevOutput.rows !== output.rows ||
      prevOutput.characterSet !== output.characterSet ||
      prevOutput.colorMapping !== output.colorMapping ||
      prevPreprocessing.whitePoint !== preprocessing.whitePoint ||
      prevPreprocessing.blackPoint !== preprocessing.blackPoint ||
      prevPreprocessing.brightness !== preprocessing.brightness ||
      prevPreprocessing.invert !== preprocessing.invert ||
      prevPreprocessing.dithering !== preprocessing.dithering ||
      prevPreprocessing.ditheringAlgorithm !== preprocessing.ditheringAlgorithm
    )
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
        return {
          ...prev,
          [section]: {
            ...prev[section],
            ...newValues,
          },
        }
      })
    },
    [],
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
  const updateSourceAndAspectRatio = async (
    imageUrl: string,
    type: 'image' | 'gif',
    fileName?: string,
  ) => {
    const { aspectRatio, width, height } = await setAspectRatioFromImage(imageUrl)

    if (type === 'image') {
      updateSettings('animation', { animationLength: 1 })
    }

    // Generate filename for screenshots if not provided
    const finalFileName =
      fileName ||
      (() => {
        const now = new Date()
        const hours = now.getHours().toString().padStart(2, '0')
        const minutes = now.getMinutes().toString().padStart(2, '0')
        const seconds = now.getSeconds().toString().padStart(2, '0')
        return `Img-${hours}-${minutes}-${seconds}.png`
      })()

    // Update all settings at once to avoid race conditions
    setSettings((prev) => ({
      ...prev,
      source: {
        ...prev.source,
        data: imageUrl,
        type,
        imageDimensions: { width, height }, // Store dimensions with source
        fileName: finalFileName,
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
            updateSourceAndAspectRatio(result, sourceType, file.name)
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
    setCurrentImageData(null)
    setCurrentFrames(null)
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
    setPendingCode(DEFAULT_CODE)
    setCurrentImageData(null)
    setCurrentFrames(null)
    updateSettings('source', {
      data: null,
      code: DEFAULT_CODE,
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

        // If the imported project has code, show the code sidebar
        if (projectData.settings.source.code) {
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
              {/* Preprocessing (always visible) */}
              <PreprocessingOptions
                settings={settings.preprocessing}
                updateSettings={(changes) => updateSettings('preprocessing', changes)}
              />
              <hr />
              {/* Output Options */}
              <OutputOptions
                settings={settings.output}
                updateSettings={(changes) => updateSettings('output', changes)}
              />
              {/* Animation Options (always visible) */}
              <hr />
              <AnimationOptions
                settings={settings.animation}
                updateSettings={(changes) => updateSettings('animation', changes)}
              />
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
              program={program}
              dimensions={{
                width: settings.output.columns,
                height: settings.output.rows,
              }}
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
