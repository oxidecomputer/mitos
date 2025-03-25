import type React from 'react'
import { useState } from 'react'

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
import { Slider } from '~/components/ui/slider'
import { Switch } from '~/components/ui/switch'

import type { GridType, SourceType } from './ascii-art-generator'

interface OutputConfigurationProps {
  settings: {
    characterSet: string
    grid: GridType
    showUnderlyingImage: boolean
    columns: number
    rows: number
  }
  updateSettings: (
    settings: Partial<{
      characterSet: string
      grid: GridType
      showUnderlyingImage: boolean
      columns: number
      rows: number
    }>,
  ) => void
  sourceType: SourceType
}

export const predefinedCharacterSets = {
  light: '=-:. ',
  boxes: '█▉▊▋▌▍▎▏',
  binaryBoxes: '▊⎕ ',
  binary: '10 ',
  binaryDirection: '–| ',
  steps: ' .–=▂▄▆█',
  intersect: '└┧─┨┕┪┖┫┘┩┙┪━',
  standard: '.,-~:;=!*#$@',
  numbers: '0123456789 ',
}

export function OutputConfiguration({
  settings,
  updateSettings,
  sourceType,
}: OutputConfigurationProps) {
  const [selectedCharSet, setSelectedCharSet] = useState('light')

  const handleCharacterSetChange = (value: string) => {
    setSelectedCharSet(value)
    if (value === 'custom') return
    updateSettings({
      characterSet: predefinedCharacterSets[value as keyof typeof predefinedCharacterSets],
    })
  }

  const handleCustomCharacterSetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ characterSet: e.target.value })
    setSelectedCharSet('custom')
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-medium">Output Configuration</h3>
      <div className="space-y-4">
        {sourceType !== 'code' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="characterSet">Character Set</Label>
              <Select onValueChange={handleCharacterSetChange} value={selectedCharSet}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a character set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="boxes">Boxes</SelectItem>
                  <SelectItem value="binaryBoxes">Binary Boxes</SelectItem>
                  <SelectItem value="binary">Binary</SelectItem>
                  <SelectItem value="binaryDirection">Binary Direction</SelectItem>
                  <SelectItem value="steps">Steps</SelectItem>
                  <SelectItem value="intersect">Intersect</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="numbers">Numbers</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customCharacterSet">Custom Character Set</Label>
              <Input
                id="customCharacterSet"
                value={settings.characterSet}
                onChange={handleCustomCharacterSetChange}
                placeholder="Enter custom characters"
                className="[font-family:GT_America_Mono]"
              />
              <p className="text-xs text-muted-foreground">
                Characters ordered from darkest to lightest
              </p>
            </div>
          </>
        )}

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="columns">Columns</Label>
            <span className="text-sm text-muted-foreground">{settings.columns}</span>
          </div>
          <Slider
            id="columns"
            min={20}
            max={240}
            step={1}
            value={[settings.columns]}
            onValueChange={(value) => updateSettings({ columns: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="rows">Rows</Label>
            <span className="text-sm text-muted-foreground">{settings.rows}</span>
          </div>
          <Slider
            id="rows"
            min={10}
            max={120}
            step={1}
            value={[settings.rows]}
            onValueChange={(value) => updateSettings({ rows: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <Label>Grid Lines</Label>
          <RadioGroup
            value={settings.grid}
            onValueChange={(value) => updateSettings({ grid: value as GridType })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="grid-none" />
              <Label htmlFor="grid-none">No Grid</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="horizontal" id="grid-horizontal" />
              <Label htmlFor="grid-horizontal">Horizontal Lines</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="vertical" id="grid-vertical" />
              <Label htmlFor="grid-vertical">Vertical Lines</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="both" id="grid-both" />
              <Label htmlFor="grid-both">Both</Label>
            </div>
          </RadioGroup>
        </div>

        {sourceType === 'image' && (
          <div className="flex items-center justify-between">
            <Label htmlFor="show-underlying-image">Show Image</Label>
            <Switch
              id="show-underlying-image"
              checked={settings.showUnderlyingImage}
              onCheckedChange={(checked) =>
                updateSettings({ showUnderlyingImage: checked })
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
