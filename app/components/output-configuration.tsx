/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useState } from 'react'

import { InputSwitch } from '~/lib/ui/src'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'
import { InputText } from '~/lib/ui/src/components/InputText/InputText'

import type { ColorMappingType, GridType, SourceType } from './ascii-art-generator'
import { AspectRatioInputNumber } from './aspect-ratio-input-number'
import { Container } from './container'

interface OutputConfigurationProps {
  settings: {
    characterSet: string
    grid: GridType
    showUnderlyingImage: boolean
    columns: number
    rows: number
    aspectRatio?: number
    colorMapping: ColorMappingType
  }
  updateSettings: (
    settings: Partial<{
      characterSet: string
      grid: GridType
      showUnderlyingImage: boolean
      columns: number
      rows: number
      aspectRatio?: number
      colorMapping: ColorMappingType
    }>,
  ) => void
  sourceType: SourceType
}

export const predefinedCharacterSets = {
  standard: ' .,-~:;=!*#$@',
  light: '=-:. ',
  boxes: '█▉▊▋▌▍▎▏',
  binaryBoxes: '▊⎕ ',
  binary: '10 ',
  binaryDirection: '–| ',
  steps: ' .–=▂▄▆█',
  intersect: '└┧─┨┕┪┖┫┘┩┙┪━',
  numbers: '0123456789 ',
}

const characterSets: CharacterSet[] = [
  'standard',
  'light',
  'boxes',
  'binaryBoxes',
  'binary',
  'binaryDirection',
  'steps',
  'intersect',
  'numbers',
  'custom',
]

type CharacterSet = keyof typeof predefinedCharacterSets | 'custom'

const gridOptions: GridType[] = ['none', 'horizontal', 'vertical', 'both']

const colorMappingOptions: ColorMappingType[] = ['brightness', 'hue', 'saturation']

export function OutputConfiguration({
  settings,
  updateSettings,
  sourceType,
}: OutputConfigurationProps) {
  const [selectedCharSet, setSelectedCharSet] = useState('standard')

  const handleCharacterSetChange = (value: string) => {
    setSelectedCharSet(value)
    if (value === 'custom') return
    updateSettings({
      characterSet: predefinedCharacterSets[value as keyof typeof predefinedCharacterSets],
    })
  }

  const handleCustomCharacterSetChange = (val: string) => {
    updateSettings({ characterSet: val })
    setSelectedCharSet('custom')
  }

  return (
    <Container>
      {sourceType !== 'code' && (
        <>
          <InputSelect<CharacterSet>
            value={selectedCharSet as CharacterSet}
            onChange={handleCharacterSetChange}
            options={characterSets}
            labelize={(label) => label}
            placeholder="Select a character set"
          >
            Character Set
          </InputSelect>

          <div className="dedent">
            <InputText
              value={settings.characterSet}
              onChange={handleCustomCharacterSetChange}
              placeholder="Enter custom characters"
              className="[fontFamily:--font-mono]"
            />
          </div>

          <InputSelect<ColorMappingType>
            value={settings.colorMapping}
            onChange={(value) => updateSettings({ colorMapping: value })}
            options={colorMappingOptions}
            labelize={(option) => {
              const labels = {
                brightness: 'Brightness',
                hue: 'Hue',
                saturation: 'Saturation',
              }
              return labels[option]
            }}
          >
            Color Mapping
          </InputSelect>
        </>
      )}

      <AspectRatioInputNumber
        width={settings.columns}
        height={settings.rows}
        onWidthChange={(value) => updateSettings({ columns: value })}
        onHeightChange={(value) => updateSettings({ rows: value })}
        aspectRatio={settings.aspectRatio}
        onAspectRatioChange={(value) => updateSettings({ aspectRatio: value })}
        minWidth={20}
        maxWidth={240}
        minHeight={10}
        maxHeight={120}
      />

      <InputSelect<GridType>
        value={settings.grid}
        onChange={(value) => updateSettings({ grid: value })}
        options={gridOptions}
        labelize={(option) => {
          const labels = {
            none: 'No Grid',
            horizontal: 'Horizontal Lines',
            vertical: 'Vertical Lines',
            both: 'Both',
          }
          return labels[option]
        }}
      >
        Grid Lines
      </InputSelect>

      {sourceType === 'image' && (
        <div className="flex items-center justify-between">
          <InputSwitch
            checked={settings.showUnderlyingImage}
            onChange={(checked) => updateSettings({ showUnderlyingImage: checked })}
          >
            Show Image
          </InputSwitch>
        </div>
      )}
    </Container>
  )
}
