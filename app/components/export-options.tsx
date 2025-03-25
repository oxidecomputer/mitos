import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import { Copy, Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useToast } from '~/components/ui/use-toast'
import type { Program } from '~/lib/animation'

import { type SourceType } from './ascii-art-generator'
import { getContent, type AnimationController } from './ascii-preview'

export type ExportFormat = 'frames' | 'png' | 'svg'
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
  const { toast } = useToast()
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    sourceType === 'code' ? 'frames' : 'png',
  )
  const [exportScale, setExportScale] = useState<ExportScale>('2x')

  useEffect(() => {
    if (sourceType === 'code') {
      setExportFormat('frames')
    } else if (exportFormat === 'frames') {
      setExportFormat('png')
    }
  }, [sourceType])

  const exportContent = async () => {
    if (!program) return

    try {
      setIsExporting(true)

      const isAnimated =
        (sourceType === 'code' || sourceType === 'gif' || sourceType === 'video') &&
        animationController
      const totalFrames = isAnimated ? animationLength : 1

      // Pause animation during export if animated
      let wasPlaying = false
      if (isAnimated && animationController) {
        wasPlaying = !animationController.getState().once
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
      toast({
        title: 'Export failed',
        description: 'An error occurred while exporting',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportSingleFrame = async () => {
    toast({
      title: 'Exporting frame',
      description: 'Preparing image...',
    })

    // Allow DOM to update
    await new Promise((resolve) => setTimeout(resolve, 50))

    if (exportFormat === 'svg') {
      await exportAsSvg()
    } else {
      await exportAsPng()
    }
  }

  const exportAsPng = async () => {
    const canvas = await captureFrame()
    if (!canvas) return

    canvas.toBlob(
      (blob) => {
        if (blob) saveAs(blob, 'ascii-art.png')
      },
      'image/png',
      1.0,
    )

    toast({
      title: 'Export complete',
      description: 'Frame has been exported as PNG',
    })
  }

  const generateSvgContent = () => {
    const asciiElement = document.querySelector('.ascii-animation pre')

    if (!asciiElement) {
      toast({
        title: 'Export failed',
        description: 'Could not find ASCII content',
        variant: 'destructive',
      })
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
      toast({
        title: 'SVG Export failed',
        description: 'Error creating SVG file',
        variant: 'destructive',
      })
      return null
    }
  }

  const exportAsSvg = async () => {
    const svgContent = generateSvgContent()
    if (!svgContent) return

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    saveAs(blob, 'ascii-art.svg')

    toast({
      title: 'Export complete',
      description: 'ASCII art has been exported as SVG vector graphics',
    })
  }

  const copySvgToClipboard = async () => {
    if (!program) return

    try {
      setIsExporting(true)

      // Allow DOM to update
      await new Promise((resolve) => setTimeout(resolve, 50))

      const svgContent = generateSvgContent()
      if (!svgContent) return

      // Copy SVG content to clipboard
      await navigator.clipboard.writeText(svgContent)

      toast({
        title: 'Copied to clipboard',
        description: 'SVG has been copied to clipboard. You can paste it into Figma.',
      })
    } catch (error) {
      console.error('Error copying SVG to clipboard:', error)
      toast({
        title: 'Copy failed',
        description: 'Failed to copy SVG to clipboard',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
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

  const exportAnimationFrames = async (
    totalFrames: number,
    currentFrame: number,
    wasPlaying: boolean,
  ) => {
    const zip = new JSZip()

    toast({
      title: 'Exporting frames',
      description: `Preparing ${totalFrames} frames for export...`,
    })

    for (let i = 0; i < totalFrames; i++) {
      if (animationController) {
        animationController.setFrame(i)
      }

      // Allow DOM to update
      await new Promise((resolve) => setTimeout(resolve, 50))

      const canvas = await captureFrame()
      if (!canvas) continue

      // Convert canvas to blob and add to zip
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), 'image/png', 1.0),
      )

      zip.file(`frame_${String(i).padStart(4, '0')}.png`, blob)

      // Update progress
      if (i % 5 === 0 || i === totalFrames - 1) {
        toast({
          title: 'Exporting frames',
          description: `Progress: ${Math.round(((i + 1) / totalFrames) * 100)}%`,
        })
      }
    }

    if (animationController) {
      animationController.setFrame(currentFrame)
      if (wasPlaying) {
        animationController.togglePlay(true)
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, 'ascii-animation-frames.zip')

    toast({
      title: 'Export complete',
      description: 'All frames have been exported as PNG files in a zip archive',
    })
  }

  // The ASCII is HTML so we need some way to turn it into an image
  const captureFrame = async () => {
    const asciiParent = document.querySelector('.ascii-animation')?.parentElement
    if (!asciiParent) return null

    // Contains both the ASCII and grid overlay
    const containerElement = asciiParent

    // Convert scale string to number (e.g., '2x' -> 2)
    const scaleValue = parseInt(exportScale.replace('x', ''))

    return html2canvas(containerElement as HTMLElement, {
      backgroundColor: 'white',
      scale: scaleValue, // Use the selected scale
      logging: false,
      allowTaint: true,
      useCORS: true,
      removeContainer: false,
    })
  }

  useEffect(() => {
    const isAnimated =
      sourceType === 'code' || sourceType === 'gif' || sourceType === 'video'
    if (isAnimated && animationLength > 1) {
      setExportFormat('frames')
    } else {
      setExportFormat('svg')
    }
  }, [sourceType, animationLength])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-4 text-lg font-medium">Export Options</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="export-format">Format</Label>
            <Select
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as ExportFormat)}
              disabled={isExporting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Export as" />
              </SelectTrigger>
              <SelectContent>
                {(sourceType === 'code' || sourceType === 'gif') && animationLength > 1 ? (
                  <SelectItem value="frames">PNGs</SelectItem>
                ) : (
                  <>
                    <SelectItem value="svg">SVG</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {exportFormat !== 'svg' && (
            <div className="space-y-2">
              <Label htmlFor="export-scale">Quality</Label>
              <Select
                value={exportScale}
                onValueChange={(value) => setExportScale(value as ExportScale)}
                disabled={isExporting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Scale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x">1x</SelectItem>
                  <SelectItem value="2x">2x</SelectItem>
                  <SelectItem value="3x">3x</SelectItem>
                  <SelectItem value="4x">4x</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {exportFormat === 'svg' && (
            <Button
              className="mt-2 w-full"
              onClick={copySvgToClipboard}
              disabled={isExporting || disabled}
              variant="outline"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy SVG
            </Button>
          )}

          <Button
            className="mt-2 w-full"
            onClick={exportContent}
            disabled={isExporting || disabled}
          >
            <Download className="mr-2 h-4 w-4" />
            {sourceType === 'code' || sourceType === 'gif' || sourceType === 'video'
              ? `Export ${exportFormat === 'frames' ? 'Frames' : 'Frame'}`
              : 'Export Image'}
          </Button>
        </div>
      </div>
    </div>
  )
}
