/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas-pro'
import JSZip from 'jszip'
import { useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import type { Program } from '~/lib/animation'
import { InputButton } from '~/lib/ui/src'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'

import { type SourceType } from './ascii-art-generator'
import { getContent, type AnimationController } from './ascii-preview'
import { Container } from './container'

export type ExportFormat = 'frames' | 'png' | 'svg' | 'mp4' | 'gif'
export type ExportScale = '1x' | '2x' | '3x' | '4x'

interface ExportOptionsProps {
  program: Program | null
  sourceType: SourceType
  animationController: AnimationController
  animationLength: number
  isExporting: boolean
  setIsExporting: (exporting: boolean) => void
  dimensions: { width: number; height: number }
  gridType?: 'none' | 'horizontal' | 'vertical' | 'both'
  disabled: boolean
}

export function ExportOptions({
  program,
  sourceType,
  animationController,
  animationLength,
  isExporting,
  setIsExporting,
  dimensions,
  disabled,
}: ExportOptionsProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    sourceType === 'code' ? 'frames' : 'png',
  )
  const [exportScale, setExportScale] = useState<ExportScale>('2x')
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        if (!ffmpegRef.current) {
          toast.loading('Loading video processing library...', { id: 'ffmpeg-load' })

          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
          const ffmpeg = new FFmpeg()

          ffmpeg.on('log', ({ message }) => {
            if (message && message.includes('frame=')) {
              toast.message(message, { id: 'ffmpeg-load' })
            }
          })

          ffmpeg.on('progress', ({ progress }) => {
            toast.loading(`Encoding: ${Math.round(progress * 100)}%`, {
              id: 'video-export',
            })
          })

          const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
          const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')

          // Load with a timeout to detect hanging
          const loadPromise = ffmpeg.load({
            coreURL,
            wasmURL,
          })

          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Loading ffmpeg timed out')), 30000)
          })

          // Race the loading against the timeout
          await Promise.race([loadPromise, timeoutPromise])

          ffmpegRef.current = ffmpeg
          setFfmpegLoaded(true)
          toast.success('Video processing library loaded!', { id: 'ffmpeg-load' })
        }
      } catch (error) {
        console.error('Error loading ffmpeg:', error)
        toast.error(
          `Failed to load video processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
          {
            id: 'ffmpeg-load',
            duration: 5000,
          },
        )
        // Reset loading state so user can try again
        setFfmpegLoaded(false)
      }
    }

    if ((exportFormat === 'mp4' || exportFormat === 'gif') && !ffmpegLoaded) {
      loadFFmpeg()
    }
  }, [exportFormat, ffmpegLoaded])

  useEffect(() => {
    const isAnimated =
      (sourceType === 'code' || sourceType === 'gif' || sourceType === 'video') &&
      animationLength > 1

    if (isAnimated) {
      setExportFormat('frames')
    } else {
      setExportFormat('png')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType])

  const exportContent = async () => {
    if (!program) return

    const isAnimated =
      (sourceType === 'code' || sourceType === 'gif' || sourceType === 'video') &&
      animationController
    const totalFrames = isAnimated ? animationLength : 1
    try {
      setIsExporting(true)

      // Pause animation during export if animated
      let wasPlaying = false
      if (isAnimated && animationController) {
        wasPlaying = animationController.getState().playing
        animationController.togglePlay(false)
      }

      // Store current frame to restore later
      const currentFrame =
        isAnimated && animationController ? animationController.getState().frame : 0

      if (totalFrames === 1) {
        await exportSingleFrame()
      } else {
        await exportAnimationFrames(
          totalFrames,
          currentFrame,
          wasPlaying,
          exportFormat !== 'mp4',
        )
      }
    } catch (error) {
      console.error('Error exporting frames:', error)
      toast('An error occurred while exporting')
    } finally {
      setIsExporting(false)
    }
  }

  const exportSingleFrame = async () => {
    toast('Preparing image...')

    // Allow DOM to update
    await new Promise((resolve) => setTimeout(resolve, 50))

    if (exportFormat === 'svg') {
      await exportAsSvg()
    } else {
      await exportAsPng()
    }
  }

  const exportAsPng = async () => {
    const canvas = await captureFrame(true)
    if (!canvas) return

    canvas.toBlob(
      (blob) => {
        if (blob) saveAs(blob, 'ascii-art.png')
      },
      'image/png',
      1.0,
    )

    toast('Frame has been exported as PNG')
  }

  const generateSvgContent = () => {
    const asciiElement = document.querySelector('.ascii-animation pre')

    if (!asciiElement) {
      toast('Could not find ASCII content')
      return null
    }

    try {
      const { width, height } = dimensions
      const formattedText = getContent(dimensions)?.split('\n') || []

      const fontSize = 12
      const cellHeight = fontSize * 1.2
      const svgHeight = height * cellHeight

      const testSpan = document.createElement('span')
      testSpan.innerText = 'X'.repeat(10)
      testSpan.style.fontFamily = 'GT America Mono, monospace'
      testSpan.style.fontSize = fontSize + 'px'
      testSpan.style.position = 'absolute'
      testSpan.style.visibility = 'hidden'
      document.body.appendChild(testSpan)
      const actualCharWidth = testSpan.getBoundingClientRect().width / 10
      document.body.removeChild(testSpan)

      const measuredCellWidth = actualCharWidth
      const svgWidth = width * measuredCellWidth

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">\n`
      svgContent += '  <style>\n'
      svgContent += `    .ascii-text { font-family: GT America Mono, monospace; font-size: ${fontSize}px; letter-spacing: 0; white-space: pre; }\n`
      svgContent +=
        '    .grid-line { stroke: #666666; stroke-width: 0.5; stroke-opacity: 0.5; }\n'
      svgContent += '  </style>\n'
      svgContent += '  <rect width="100%" height="100%" fill="transparent"/>\n'

      const gridElement = document.querySelector('.grid-overlay')
      const gridType = gridElement?.getAttribute('data-grid-type') || 'none'

      if (gridType !== 'none') {
        svgContent += '  <!-- Grid overlay -->\n'
        svgContent += '  <g class="grid">\n'

        if (gridType === 'horizontal' || gridType === 'both') {
          for (let i = 1; i < height; i++) {
            const y = i * cellHeight
            svgContent += `    <line class="grid-line" x1="0" y1="${y}" x2="${svgWidth}" y2="${y}" />\n`
          }
        }

        if (gridType === 'vertical' || gridType === 'both') {
          for (let i = 1; i < width; i++) {
            const x = i * measuredCellWidth
            svgContent += `    <line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="${svgHeight}" />\n`
          }
        }

        svgContent += '  </g>\n'
      }

      svgContent += `  <text x="0" y="${fontSize}" class="ascii-text">\n`

      formattedText.forEach((line, index) => {
        // Replace regular spaces with non-breaking spaces to preserve spacing
        const processedLine = line.replace(/ /g, '\u00A0') // Unicode non-breaking space
        svgContent += `    <tspan x="0" dy="${index === 0 ? 0 : cellHeight}">${escapeXml(processedLine)}</tspan>\n`
      })

      svgContent += '  </text>\n'
      svgContent += '</svg>'

      return svgContent
    } catch (error) {
      console.error('Error creating SVG:', error)
      toast('Error creating SVG file')
      return null
    }
  }

  const exportAsSvg = async () => {
    const svgContent = generateSvgContent()
    if (!svgContent) return

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    saveAs(blob, 'ascii-art.svg')

    toast('Exported as SVG')
  }

  const copySvg = async () => {
    if (!program) return

    try {
      setIsExporting(true)

      // Allow DOM to update
      await new Promise((resolve) => setTimeout(resolve, 50))

      const svgContent = generateSvgContent()
      if (!svgContent) return

      // Copy SVG content to clipboard
      await navigator.clipboard.writeText(svgContent)

      toast('SVG has been copied to clipboard')
    } catch (error) {
      console.error('Error copying SVG to clipboard:', error)
      toast('Failed to copy SVG to clipboard')
    } finally {
      setIsExporting(false)
    }
  }

  // Convert ASCII data to text with line breaks and copy to clipboard
  // Adds line breaks based on column width
  const copyText = () => {
    if (!program) return

    try {
      navigator.clipboard.writeText(getContent(dimensions) || '').then(() => {
        toast('ASCII art has been copied to your clipboard')
      })
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast('Could not copy to clipboard')
    }
  }

  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;'
        case '>':
          return '&gt;'
        case '&':
          return '&amp;'
        case "'":
          return '&apos;'
        case '"':
          return '&quot;'
        default:
          return c
      }
    })
  }

  const exportAsVideo = async (frames: Blob[]) => {
    if (!ffmpegLoaded || !ffmpegRef.current) {
      toast.error('Video processing library not loaded')
      return
    }

    try {
      const ffmpeg = ffmpegRef.current
      toast.loading('Processing video...', { id: 'video-export' })

      // Write each frame to the virtual file system
      for (let i = 0; i < frames.length; i++) {
        const frameName = `frame_${String(i).padStart(4, '0')}.png`
        const frameData = await fetchFile(frames[i])
        await ffmpeg.writeFile(frameName, frameData)

        if (i % 10 === 0 || i === frames.length - 1) {
          toast.loading(
            `Preparing frames: ${Math.round(((i + 1) / frames.length) * 100)}%`,
            {
              id: 'video-export',
            },
          )
        }
      }

      // Generate the video based on selected format
      const fps = Math.min(30, Math.max(10, animationController?.getState().fps || 24))
      const outputFilename = `output.${exportFormat}`

      toast.loading('Encoding video...', { id: 'video-export' })

      if (exportFormat === 'gif') {
        await ffmpeg.exec([
          '-framerate',
          `${fps}`,
          '-pattern_type',
          'glob',
          '-i',
          'frame_*.png',
          '-vf',
          'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
          '-f',
          'gif',
          outputFilename,
        ])
      } else {
        await ffmpeg.exec([
          '-framerate',
          `${fps}`,
          '-pattern_type',
          'glob',
          '-i',
          'frame_*.png',
          '-vf',
          'format=yuv420p',
          '-c:v',
          'libx264',
          outputFilename,
        ])
      }

      // Read the output file
      const data = await ffmpeg.readFile(outputFilename)
      const blob = new Blob([data instanceof Uint8Array ? data.buffer : data], {
        type: exportFormat === 'mp4' ? 'video/mp4' : 'image/gif',
      })

      // Save the video
      saveAs(blob, `ascii-animation.${exportFormat}`)
      toast.success('Video export complete!', { id: 'video-export' })
    } catch (error) {
      console.error('Error encoding video:', error)
      toast.error('Failed to create video', { id: 'video-export' })
    }
  }

  const exportAnimationFrames = async (
    totalFrames: number,
    currentFrame: number,
    wasPlaying: boolean,
    transparent: boolean,
  ) => {
    const frames: Blob[] = []

    for (let i = 0; i < totalFrames; i++) {
      if (animationController) {
        animationController.setFrame(i)
      }

      // Allow DOM to update
      await new Promise((resolve) => setTimeout(resolve, 50))

      const canvas = await captureFrame(transparent)
      if (!canvas) continue

      // Convert canvas to blob and add to zip
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), 'image/png', 1.0),
      )

      frames.push(blob)

      if (i % 5 === 0 || i === totalFrames - 1) {
        toast.loading(`Capturing frames: ${Math.round(((i + 1) / totalFrames) * 100)}%`, {
          id: 'video-export',
        })
      }
    }

    // Restore animation state
    if (animationController) {
      animationController.setFrame(currentFrame)
      if (wasPlaying) {
        animationController.togglePlay(true)
      }
    }

    // Either export as video or as frame zip
    if (exportFormat === 'mp4' || exportFormat === 'gif') {
      await exportAsVideo(frames)
    } else {
      // Original frames export code
      const zip = new JSZip()
      frames.forEach((blob, i) => {
        zip.file(`frame_${String(i).padStart(4, '0')}.png`, blob)
      })

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveAs(zipBlob, 'ascii-animation-frames.zip')
      toast.success('Export complete!', { id: 'export-progress' })
    }
  }

  // The ASCII is HTML so we need some way to turn it into an image
  const captureFrame = async (transparent: boolean) => {
    const asciiParent = document.querySelector('.ascii-animation')?.parentElement
    if (!asciiParent) return null

    // Contains both the ASCII and grid overlay
    const containerElement = asciiParent

    // Convert scale string to number (e.g., '2x' -> 2)
    const scaleValue = parseInt(exportScale.replace('x', ''))

    return html2canvas(containerElement as HTMLElement, {
      backgroundColor: transparent ? 'transparent' : 'white',
      scale: scaleValue,
      logging: false,
      allowTaint: true,
      useCORS: true,
      removeContainer: false,
      onclone: (document) => {
        // Find elements with CSS color functions and simplify them
        const elements = document.querySelectorAll('*')
        elements.forEach((el) => {
          const style = window.getComputedStyle(el)
          const color = style.color
          if (color.includes('color(')) {
            // Set to a basic color that html2canvas can handle
            ;(el as HTMLElement).style.color = 'currentColor'
          }
        })
      },
    })
  }

  // Copy with cmd+c
  useHotkeys('meta+c', () => copyText(), { preventDefault: true }, [])

  // Copy svg with ctrl+shift+c
  useHotkeys('ctrl+shift+c', () => copySvg(), { preventDefault: true }, [])

  return (
    <Container>
      <InputSelect
        value={exportFormat}
        onChange={(value) => {
          setExportFormat(value as ExportFormat)
        }}
        options={
          (sourceType === 'code' || sourceType === 'gif' || sourceType === 'video') &&
          animationLength > 1
            ? (['mp4', 'gif', 'frames'] as ExportFormat[])
            : (['svg', 'png'] as ExportFormat[])
        }
        labelize={(format) => {
          switch (format) {
            case 'frames':
              return 'PNGs'
            case 'mp4':
            case 'gif':
              return format.toUpperCase()
            default:
              return format.toUpperCase()
          }
        }}
        disabled={isExporting}
      >
        Format
      </InputSelect>

      {(exportFormat === 'png' ||
        exportFormat === 'frames' ||
        exportFormat === 'mp4' ||
        exportFormat === 'gif') && (
        <InputSelect
          value={exportScale}
          onChange={(value) => setExportScale(value as ExportScale)}
          options={['1x', '2x', '3x', '4x']}
          disabled={isExporting}
        >
          Quality
        </InputSelect>
      )}

      <div className="space-y-2">
        <InputButton
          variant="secondary"
          className="mt-2 w-full"
          onClick={exportContent}
          disabled={
            isExporting ||
            disabled ||
            ((exportFormat === 'mp4' || exportFormat === 'gif') && !ffmpegLoaded)
          }
        >
          {exportFormat === 'mp4' || exportFormat === 'gif'
            ? `Export as ${exportFormat.toUpperCase()}`
            : sourceType === 'code' || sourceType === 'gif' || sourceType === 'video'
              ? `Export ${exportFormat === 'frames' ? 'Frames' : 'Frame'}`
              : 'Export Image'}
        </InputButton>

        <div className="flex gap-2">
          <InputButton
            variant="secondary"
            onClick={copyText}
            disabled={isExporting || disabled}
          >
            Copy text
          </InputButton>

          <InputButton
            variant="secondary"
            onClick={copySvg}
            disabled={isExporting || disabled}
          >
            Copy SVG
          </InputButton>
        </div>
      </div>
    </Container>
  )
}
