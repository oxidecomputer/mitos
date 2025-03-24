import { useEffect, useState } from 'react'

import { AsciiPreview, type AnimationController } from '~/components/ascii-preview'
import { ExportOptions } from '~/components/export-options'
import {
  OutputConfiguration,
  predefinedCharacterSets,
} from '~/components/output-configuration'
import { PreprocessingControls } from '~/components/preprocessing-controls'
import { ProjectManagement } from '~/components/project-management'
import { SourceSelector } from '~/components/source-selector'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useToast } from '~/components/ui/use-toast'
import type { Program } from '~/lib/animation'
import { createCodeAsciiProgram, createImageAsciiProgram } from '~/lib/ascii-program'
import { processCodeModule, processImage } from '~/lib/image-processor'
import type { Data } from '~/lib/types'

import { AnimationOptions } from './animation-options'

export type SourceType = 'image' | 'code'
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
  }
  animation: {
    animationLength: number
    frameRate: number
  }
}

const defaultCode = `const density = 'Ñ@#W$9876543210?!abc;:+=-,._ ';

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

//Optional: Runs at the start of each frame
function pre(context, cursor, buffer, userData) {}

// Optional: Runs after each frame is complete
function post(context, cursor, buffer, userData) {}`

const defaultSettings: AsciiSettings = {
  source: {
    type: 'image',
    data: null,
    code: defaultCode,
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
  const [settings, setSettings] = useState<AsciiSettings>(defaultSettings)
  const [program, setProgram] = useState<Program | null>(null)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [animationController, setAnimationController] = useState<AnimationController>(null)
  const [isExporting, setIsExporting] = useState(false)

  const { toast } = useToast()

  // Process ASCII data and create program when settings change
  useEffect(() => {
    async function process() {
      if (!settings.source.data && settings.source.type !== 'code') return

      try {
        let newAsciiData: Data = {}

        const columns = settings.output.columns || 80
        const rows = settings.output.rows || 40

        if (settings.source.type === 'image' && settings.source.data) {
          const result = await processImage(settings.source.data, settings)
          newAsciiData = result.data

          if (result.processedImageUrl) {
            setProcessedImageUrl(result.processedImageUrl)
          }

          const newProgram = await createImageAsciiProgram(newAsciiData, columns, rows)
          setProgram(newProgram)
        } else if (settings.source.type === 'code') {
          const module = processCodeModule(settings.source.code)
          if (!module) {
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
      } catch (error) {
        toast({
          title: 'Error generating ASCII art',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      } finally {
      }
    }

    process()
  }, [settings, toast])

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
      <div className="left-0 top-0 h-full w-64 transform overflow-hidden border-r bg-background duration-300 ease-in-out">
        <div className="flex h-full flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4">
              <div className="space-y-4">
                <ProjectManagement settings={settings} updateSettings={updateSettings} />
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <Tabs
                  defaultValue="image"
                  onValueChange={(value) =>
                    updateSourceSettings({ type: value as SourceType })
                  }
                >
                  <TabsList className="mb-4 grid grid-cols-2">
                    <TabsTrigger value="image">Image</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                  </TabsList>

                  <TabsContent value="image" className="mt-0">
                    <SourceSelector
                      type="image"
                      settings={settings.source}
                      updateSettings={updateSourceSettings}
                    />
                  </TabsContent>

                  {/* Only show selector in sidebar for image mode */}
                  {settings.source.type !== 'code' && (
                    <TabsContent value="code" className="mt-0">
                      <SourceSelector
                        type="code"
                        settings={settings.source}
                        updateSettings={updateSourceSettings}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              </div>

              {settings.source.type !== 'code' && (
                <>
                  <Separator className="my-6" />
                  <div className="space-y-4">
                    <PreprocessingControls
                      settings={settings.preprocessing}
                      updateSettings={updatePreprocessingSettings}
                    />
                  </div>
                </>
              )}

              <Separator className="my-6" />

              <div className="space-y-4">
                <OutputConfiguration
                  settings={settings.output}
                  updateSettings={updateOutputSettings}
                  sourceType={settings.source.type}
                />
              </div>

              {settings.source.type === 'code' && (
                <>
                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <AnimationOptions
                      settings={settings.animation}
                      updateSettings={updateAnimationSettings}
                    />
                  </div>
                </>
              )}

              <Separator className="my-6" />

              {/* Export Options */}
              <div className="space-y-4">
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
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
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
            />
          </div>

          {settings.source.type === 'code' && (
            <div className="w-1/2 max-w-[30rem] overflow-auto border-l bg-background p-4">
              <SourceSelector
                type="code"
                settings={settings.source}
                updateSettings={updateSourceSettings}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
