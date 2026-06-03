/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { Recorder } from 'canvas-record'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { AVC } from 'media-codecs'
import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import type { Cell, Program } from '~/lib/animation'
import { getColoredRows, getContent } from '~/lib/buffer-text'
import { glyphRunToPathData, loadAsciiFont, type Font } from '~/lib/svg-font'
import { InputButton, InputNumber, InputSwitch } from '~/lib/ui/src'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'

import { type AnimationController } from './ascii-preview'
import { Container } from './container'
import {
  calculateAspectRatio,
  calculateContentDimensions,
  calculateExportDimensions,
  CHAR_WIDTH,
} from './dimension-utils'

export type ExportFormat = 'frames' | 'png' | 'svg' | 'mp4'

interface ExportDimensions {
  width: number
  height: number
}

interface AssetExportProps {
  program: Program | null
  animationController: AnimationController
  animationLength: number
  isExporting: boolean
  setIsExporting: (exporting: boolean) => void
  dimensions: { width: number; height: number }
  disabled: boolean
  exportSettings: {
    textColor: string
    backgroundColor: string
    padding: number
  }
}

export function AssetExport({
  program,
  animationController,
  animationLength,
  isExporting,
  setIsExporting,
  dimensions,
  disabled,
  exportSettings,
}: AssetExportProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    animationLength > 1 ? 'frames' : 'png',
  )
  const [exportDimensions, setExportDimensions] = useState<ExportDimensions>({
    width: 1920,
    height: 1080,
  })

  const [trimEnabled, setTrimEnabled] = useState(false)
  const [trimX, setTrimX] = useState(0)
  const [trimY, setTrimY] = useState(0)

  // When on, SVG export outlines glyphs to <path> data
  const [flattenSvg, setFlattenSvg] = useState(false)

  // Set export height based on character dimensions including padding
  useEffect(() => {
    const { totalWidth, totalHeight } = calculateContentDimensions(
      dimensions,
      exportSettings.padding,
    )
    const aspectRatio = calculateAspectRatio(totalWidth, totalHeight)
    setExportDimensions((prev) => ({
      ...prev,
      height: Math.round(prev.width * aspectRatio),
    }))
  }, [dimensions, exportSettings.padding])

  useEffect(() => {
    const isAnimated = animationLength > 1

    if (isAnimated) {
      setExportFormat('frames')
    } else {
      setExportFormat('png')
    }
  }, [animationLength])

  const exportContent = async () => {
    if (!program) return

    const isAnimated = animationController && animationLength > 1
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
        await exportAnimationFrames(totalFrames, currentFrame, wasPlaying)
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
    await waitForPaint()

    if (exportFormat === 'svg') {
      await exportAsSvg()
    } else {
      await exportAsPng()
    }
  }

  const exportAsPng = async () => {
    if (!animationController) {
      toast.error('Animation controller not available')
      return
    }

    // Apply trim adjustments
    const finalWidth = trimEnabled ? exportDimensions.width + trimX : exportDimensions.width
    const finalHeight = trimEnabled
      ? exportDimensions.height + trimY
      : exportDimensions.height

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = finalWidth
    exportCanvas.height = finalHeight

    const buffer = animationController.getBuffer()
    const metrics = animationController.getMetrics()
    if (!metrics) {
      toast.error('Animation metrics not available')
      return
    }

    // Calculate padding for export using calculateContentDimensions
    const { pixelHeight, paddingPixels } = calculateContentDimensions(
      dimensions,
      exportSettings.padding,
    )
    const previewTotalHeight = pixelHeight + paddingPixels * 2
    const scale = finalHeight / previewTotalHeight
    const exportPadding = paddingPixels * scale

    renderBufferToCanvas(
      exportCanvas,
      buffer,
      dimensions,
      exportSettings,
      metrics.fontSize,
      metrics.lineHeight,
      exportPadding,
    )

    exportCanvas.toBlob(
      (blob) => {
        if (blob) saveAs(blob, 'ascii-art.png')
      },
      'image/png',
      1.0,
    )

    toast('Frame has been exported as PNG')
  }

  const generateSvgContent = async () => {
    if (!animationController) {
      toast('Could not find ASCII content')
      return null
    }

    try {
      const { width, height } = dimensions
      const coloredRows = getColoredRows(
        dimensions,
        animationController,
        exportSettings.textColor,
      )

      // Outlining is opt-in and needs the parsed font
      let font: Font | null = null
      if (flattenSvg) {
        try {
          font = await loadAsciiFont()
        } catch (error) {
          console.error('Could not load font for flattening:', error)
          toast('Could not load font to flatten — exporting as text')
        }
      }

      const padding = exportSettings.padding * CHAR_WIDTH

      const fontSize = 12
      const cellHeight = fontSize * 1.2
      const svgHeight = height * cellHeight
      const paddedSvgHeight = svgHeight + padding * 2

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
      const paddedSvgWidth = svgWidth + padding * 2

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${paddedSvgWidth}" height="${paddedSvgHeight}" viewBox="0 0 ${paddedSvgWidth} ${paddedSvgHeight}">\n`
      svgContent += '  <style>\n'
      svgContent += `    .ascii-text { font-family: GT America Mono, monospace; font-size: ${fontSize}px; letter-spacing: 0; white-space: pre; }\n`
      svgContent +=
        '    .grid-line { stroke: #666666; stroke-width: 0.5; stroke-opacity: 0.5; }\n'
      svgContent += '  </style>\n'
      svgContent += `  <rect width="100%" height="100%" fill="${exportSettings.backgroundColor}"/>\n`

      const gridElement = document.querySelector('.grid-overlay')
      const gridType = gridElement?.getAttribute('data-grid-type') || 'none'

      if (gridType !== 'none') {
        svgContent += '  <!-- Grid overlay -->\n'
        svgContent += '  <g class="grid">\n'

        if (gridType === 'horizontal' || gridType === 'both') {
          for (let i = 1; i < height; i++) {
            const y = i * cellHeight + padding
            svgContent += `    <line class="grid-line" x1="${padding}" y1="${y}" x2="${svgWidth + padding}" y2="${y}" />\n`
          }
        }

        if (gridType === 'vertical' || gridType === 'both') {
          for (let i = 1; i < width; i++) {
            const x = i * measuredCellWidth + padding
            svgContent += `    <line class="grid-line" x1="${x}" y1="${padding}" x2="${x}" y2="${svgHeight + padding}" />\n`
          }
        }

        svgContent += '  </g>\n'
      }

      if (font) {
        // Flattened: emit one <path> of outlined glyphs per colour run. Glyphs
        // sit on a fixed monospace grid (measuredCellWidth) so they line up
        // with the cells exactly
        svgContent += '  <g class="ascii-text">\n'

        coloredRows.forEach((segments, index) => {
          const baselineY = padding + fontSize + index * cellHeight
          let col = 0

          segments.forEach((seg) => {
            const startX = padding + col * measuredCellWidth
            col += seg.text.length
            const d = glyphRunToPathData(
              font,
              seg.text,
              startX,
              baselineY,
              fontSize,
              measuredCellWidth,
            )
            if (d) svgContent += `    <path d="${d}" fill="${seg.color}"/>\n`
          })
        })

        svgContent += '  </g>\n'
      } else {
        svgContent += `  <text x="${padding}" y="${padding + fontSize}" class="ascii-text">\n`

        coloredRows.forEach((segments, index) => {
          if (segments.length === 0) {
            // Keep the (blank) line so following rows stay vertically aligned.
            svgContent += `    <tspan x="${padding}" dy="${index === 0 ? 0 : cellHeight}" fill="${exportSettings.textColor}"> </tspan>\n`
            return
          }

          // Each row is one or more tspans flowing left-to-right. Only the first
          // tspan of a row sets x (left margin) and advances dy to the next line;
          // the rest inherit the position so colour runs stay contiguous.
          segments.forEach((seg, segIndex) => {
            const processed = seg.text.replace(/ /g, '\u00A0') // preserve spacing
            const isFirst = segIndex === 0
            const xAttr = isFirst ? ` x="${padding}"` : ''
            const dyAttr = ` dy="${isFirst && index !== 0 ? cellHeight : 0}"`
            svgContent += `    <tspan${xAttr}${dyAttr} fill="${seg.color}">${escapeXml(processed)}</tspan>\n`
          })
        })

        svgContent += '  </text>\n'
      }

      svgContent += '</svg>'

      return svgContent
    } catch (error) {
      console.error('Error creating SVG:', error)
      toast('Error creating SVG file')
      return null
    }
  }

  const exportAsSvg = async () => {
    const svgContent = await generateSvgContent()
    if (!svgContent) return

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    saveAs(blob, 'ascii-art.svg')

    toast('Exported as SVG')
  }

  const copySvg = async () => {
    if (!program) return

    try {
      setIsExporting(true)

      const svgContent = await generateSvgContent()
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
      navigator.clipboard
        .writeText(getContent(dimensions, animationController) || '')
        .then(() => {
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

  const renderBufferToCanvas = (
    canvas: HTMLCanvasElement,
    buffer: Cell[],
    dimensions: { width: number; height: number },
    settings: { textColor: string; backgroundColor: string },
    baseFontSize: number,
    baseLineHeight: number,
    padding: number = 0,
  ) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate cell dimensions accounting for padding
    const contentWidth = canvas.width - padding * 2
    const contentHeight = canvas.height - padding * 2
    const cellWidth = contentWidth / dimensions.width
    const lineHeight = contentHeight / dimensions.height

    // Calculate font size based on the scale ratio between export and preview
    // Scale = (export lineHeight) / (base lineHeight from preview)
    const scale = lineHeight / baseLineHeight
    const fontSize = Math.round(baseFontSize * scale)

    // Wipe the canvas before painting. fillRect alone composites source-over,
    // so a transparent background would leave the previous frame's pixels
    // behind (the canvas is reused across frames) — clearRect resets to
    // transparent first.
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = settings.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = settings.textColor
    ctx.font = `${fontSize}px "GT America Mono", monospace`
    ctx.textBaseline = 'top'

    // Only touch fillStyle when a cell's colour differs from the previous one;
    // cells without an explicit colour fall back to the stock text colour.
    let currentColor = settings.textColor

    for (let i = 0; i < buffer.length; i++) {
      const col = i % dimensions.width
      const row = Math.floor(i / dimensions.width)
      const x = col * cellWidth + padding
      const y = row * lineHeight + padding

      const color = buffer[i]?.color || settings.textColor
      if (color !== currentColor) {
        ctx.fillStyle = color
        currentColor = color
      }

      ctx.fillText(buffer[i]?.char || ' ', x, y)
    }
  }

  const exportAsVideoWithCanvasRecord = async (totalFrames: number) => {
    if (!animationController) {
      toast.error('Animation controller not available')
      return
    }

    try {
      toast.loading('Initializing video encoder...', { id: 'video-export' })

      // Apply trim adjustments and ensure even dimensions for H264
      let finalWidth = trimEnabled ? exportDimensions.width + trimX : exportDimensions.width
      let finalHeight = trimEnabled
        ? exportDimensions.height + trimY
        : exportDimensions.height

      // H264 requires even dimensions - round up to nearest even number
      finalWidth = Math.ceil(finalWidth / 2) * 2
      finalHeight = Math.ceil(finalHeight / 2) * 2

      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = finalWidth
      exportCanvas.height = finalHeight

      const ctx = exportCanvas.getContext('2d')
      if (!ctx) {
        toast.error('Could not get canvas context')
        return
      }

      const recorder = new Recorder(ctx, {
        name: 'ascii-animation',
        encoderOptions: {
          codec: AVC.getCodec({ profile: 'Main', level: '5.2' }),
        },
      })

      const wasPlaying = animationController.getState().playing
      const currentFrame = animationController.getState().frame

      animationController.togglePlay(false)

      const metrics = animationController.getMetrics()
      if (!metrics) {
        toast.error('Animation metrics not available', { id: 'video-export' })
        return
      }

      // Calculate padding for export using calculateContentDimensions
      const { pixelHeight, paddingPixels } = calculateContentDimensions(
        dimensions,
        exportSettings.padding,
      )
      const previewTotalHeight = pixelHeight + paddingPixels * 2
      const scale = finalHeight / previewTotalHeight
      const exportPadding = paddingPixels * scale

      // Render frame 0 before starting (start() captures the canvas as frame 0)
      animationController.renderFrame(0)
      const firstBuffer = animationController.getBuffer()
      renderBufferToCanvas(
        exportCanvas,
        firstBuffer,
        dimensions,
        exportSettings,
        metrics.fontSize,
        metrics.lineHeight,
        exportPadding,
      )

      // Start recording (this encodes the current canvas state as frame 0)
      await recorder.start()

      // Render and record remaining frames
      for (let i = 1; i < totalFrames; i++) {
        animationController.renderFrame(i)

        const buffer = animationController.getBuffer()
        renderBufferToCanvas(
          exportCanvas,
          buffer,
          dimensions,
          exportSettings,
          metrics.fontSize,
          metrics.lineHeight,
          exportPadding,
        )

        await recorder.step()

        if (i % 5 === 0 || i === totalFrames - 1) {
          toast.loading(`Encoding: ${Math.round(((i + 1) / totalFrames) * 100)}%`, {
            id: 'video-export',
          })
        }
      }

      // Automatically saves
      recorder.stop()

      animationController.setFrame(currentFrame)
      if (wasPlaying) {
        animationController.togglePlay(true)
      }
      toast.success('Video export complete!', { id: 'video-export' })
    } catch (error) {
      console.error('Error encoding video:', error)
      toast.error('Failed to create video', { id: 'video-export' })
    }
  }

  // Wait for the browser to actually paint the new frame, rather than guessing
  // with a fixed delay. Two rAFs guarantees a render has flushed; this is both
  // faster and more reliable than a 50ms sleep, and the saving scales with the
  // number of frames (a long sequence no longer pays 50ms × N of dead time).
  const waitForPaint = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )

  const exportAnimationFrames = async (
    totalFrames: number,
    currentFrame: number,
    wasPlaying: boolean,
  ) => {
    if (exportFormat === 'mp4') {
      await exportAsVideoWithCanvasRecord(totalFrames)
      return
    }

    if (!animationController) return

    const frames: Blob[] = []

    // Apply trim adjustments
    const finalWidth = trimEnabled ? exportDimensions.width + trimX : exportDimensions.width
    const finalHeight = trimEnabled
      ? exportDimensions.height + trimY
      : exportDimensions.height

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = finalWidth
    exportCanvas.height = finalHeight

    const metrics = animationController.getMetrics()
    if (!metrics) {
      toast.error('Animation metrics not available')
      return
    }

    // Calculate padding for export using calculateContentDimensions
    const { pixelHeight, paddingPixels } = calculateContentDimensions(
      dimensions,
      exportSettings.padding,
    )
    const previewTotalHeight = pixelHeight + paddingPixels * 2
    const scale = finalHeight / previewTotalHeight
    const exportPadding = paddingPixels * scale

    for (let i = 0; i < totalFrames; i++) {
      animationController.renderFrame(i)

      const buffer = animationController.getBuffer()
      renderBufferToCanvas(
        exportCanvas,
        buffer,
        dimensions,
        exportSettings,
        metrics.fontSize,
        metrics.lineHeight,
        exportPadding,
      )

      const blob = await new Promise<Blob>((resolve) =>
        exportCanvas.toBlob((b) => resolve(b as Blob), 'image/png', 1.0),
      )

      frames.push(blob)

      if (i % 5 === 0 || i === totalFrames - 1) {
        toast.loading(`Capturing frames: ${Math.round(((i + 1) / totalFrames) * 100)}%`, {
          id: 'video-export',
        })
      }
    }

    animationController.setFrame(currentFrame)
    if (wasPlaying) {
      animationController.togglePlay(true)
    }

    const zip = new JSZip()
    frames.forEach((blob, i) => {
      zip.file(`frame_${String(i).padStart(4, '0')}.png`, blob)
    })

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, 'ascii-animation-frames.zip')
    toast.success('Export complete!', { id: 'video-export' })
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
          animationLength > 1
            ? (['mp4', 'frames'] as ExportFormat[])
            : (['svg', 'png'] as ExportFormat[])
        }
        labelize={(format) => {
          switch (format) {
            case 'frames':
              return 'PNGs'
            case 'mp4':
              return format.toUpperCase()
            default:
              return format.toUpperCase()
          }
        }}
        disabled={isExporting}
      >
        Format
      </InputSelect>

      {(exportFormat === 'png' || exportFormat === 'frames' || exportFormat === 'mp4') && (
        <div className="space-y-2">
          <div className="ui-select">
            <label className="ui-select__label">Export Size</label>
          </div>
          <div className="dedent">
            <InputNumber
              min={1}
              value={exportDimensions.width}
              onChange={(val) => {
                const newWidth = val || 0
                const newDimensions = calculateExportDimensions(
                  dimensions,
                  exportSettings.padding,
                  newWidth,
                )
                setExportDimensions(newDimensions)
              }}
            >
              Width{' '}
              {trimEnabled && trimX !== 0 && (
                <span className="text-tertiary">({exportDimensions.width + trimX})</span>
              )}
            </InputNumber>
            <InputNumber
              min={1}
              value={exportDimensions.height}
              onChange={(val) => {
                const newHeight = val || 0
                const newDimensions = calculateExportDimensions(
                  dimensions,
                  exportSettings.padding,
                  undefined,
                  newHeight,
                )
                setExportDimensions(newDimensions)
              }}
            >
              Height{' '}
              {trimEnabled && trimY !== 0 && (
                <span className="text-tertiary">({exportDimensions.height + trimY})</span>
              )}
            </InputNumber>

            <InputSwitch checked={trimEnabled} onChange={setTrimEnabled}>
              Trim Adjustment
            </InputSwitch>

            {trimEnabled && (
              <div className="dedent mt-0">
                <InputNumber
                  min={-500}
                  max={500}
                  value={trimX}
                  onChange={(val) => setTrimX(val || 0)}
                  showSlider={false}
                >
                  X Trim
                </InputNumber>
                <InputNumber
                  min={-500}
                  max={500}
                  value={trimY}
                  onChange={(val) => setTrimY(val || 0)}
                  showSlider={false}
                >
                  Y Trim
                </InputNumber>
              </div>
            )}

            <InputSwitch
              checked={flattenSvg}
              onChange={setFlattenSvg}
              disabled={isExporting}
            >
              Flatten SVG
            </InputSwitch>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <InputButton
          variant="secondary"
          className="mt-2 w-full"
          onClick={exportContent}
          disabled={isExporting || disabled}
        >
          {exportFormat === 'mp4'
            ? 'Export as MP4'
            : animationLength > 1
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
