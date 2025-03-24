import { Download } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

import type { SourceType } from './ascii-art-generator'

interface ExportOptionsProps {
  settings: {
    format: string
    animationLength: number
    frameRate: number
    loop: 'once' | 'infinite'
  }
  updateSettings: (
    settings: Partial<{
      format: string
      animationLength: number
      frameRate: number
      loop: 'once' | 'infinite'
    }>,
  ) => void
  sourceType: SourceType
}

export function ExportOptions({
  settings,
  updateSettings,
  sourceType,
}: ExportOptionsProps) {
  const isAnimated = sourceType === 'code'

  const handleExport = () => {
    console.log('Exporting with settings:', settings)
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-medium">Export Options</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="format">Format</Label>
          <Select
            value={settings.format}
            onValueChange={(value) => updateSettings({ format: value })}
          >
            <SelectTrigger id="format">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {isAnimated ? (
                <>
                  <SelectItem value="gif">GIF</SelectItem>
                  <SelectItem value="mp4">MP4</SelectItem>
                  <SelectItem value="png-sequence">PNG Sequence</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="svg">SVG</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {isAnimated && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="animationLength">Animation Length (frames)</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.animationLength}
                </span>
              </div>
              <Input
                id="animationLength"
                type="number"
                min={1}
                value={settings.animationLength}
                onChange={(e) =>
                  updateSettings({ animationLength: Number.parseInt(e.target.value) || 1 })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="frameRate">Frame Rate (FPS)</Label>
                <span className="text-sm text-muted-foreground">{settings.frameRate}</span>
              </div>
              <Input
                id="frameRate"
                type="number"
                min={1}
                max={60}
                value={settings.frameRate}
                onChange={(e) =>
                  updateSettings({ frameRate: Number.parseInt(e.target.value) || 1 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Loop</Label>
              <RadioGroup
                value={settings.loop}
                onValueChange={(value) =>
                  updateSettings({ loop: value as 'once' | 'infinite' })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="once" id="loop-once" />
                  <Label htmlFor="loop-once">Once</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="infinite" id="loop-infinite" />
                  <Label htmlFor="loop-infinite">Infinite</Label>
                </div>
              </RadioGroup>
            </div>
          </>
        )}

        <Button className="w-full" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  )
}
