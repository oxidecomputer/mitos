import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import { Download } from 'lucide-react'
import { useState } from 'react'

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
import type { AnimationController } from './ascii-preview'

export type ExportFormat = 'frames'
export type ExportScale = '1x' | '2x' | '3x' | '4x'

interface ExportOptionsProps {
  program: Program | null
  sourceType: SourceType
  animationController: AnimationController
  animationLength: number
  isExporting: boolean
  setIsExporting: (exporting: boolean) => void
}

export function ExportOptions({
  program,
  sourceType,
  animationController,
  animationLength,
  isExporting,
  setIsExporting,
}: ExportOptionsProps) {
  const { toast } = useToast()
  const [exportFormat, setExportFormat] = useState<ExportFormat>('frames')
  const [exportScale, setExportScale] = useState<ExportScale>('2x')

  const exportContent = async () => {
    if (!program) return

    try {
      setIsExporting(true)

      const isAnimated = sourceType === 'code' && animationController
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-4 text-lg font-medium">Export Options</h3>
        <div className="space-y-3">
          {sourceType === 'code' && (
            <div className="space-y-2">
              <Label htmlFor="export-format">Format</Label>
              <Select
                id="export-format"
                value={exportFormat}
                onValueChange={(value) => setExportFormat(value as ExportFormat)}
                disabled={isExporting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Export as" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frames">PNG Frames</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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

          <Button className="mt-2 w-full" onClick={exportContent} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {sourceType === 'code' ? 'Export Animation' : 'Export Image'}
          </Button>
        </div>
      </div>
    </div>
  )
}
