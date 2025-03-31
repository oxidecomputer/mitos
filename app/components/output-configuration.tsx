import { useState } from 'react'

import { InputSwitch } from '~/lib/ui/src'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'
import { InputText } from '~/lib/ui/src/components/InputText/InputText'

import type { GridType, SourceType } from './ascii-art-generator'
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
  }
  updateSettings: (
    settings: Partial<{
      characterSet: string
      grid: GridType
      showUnderlyingImage: boolean
      columns: number
      rows: number
      aspectRatio?: number
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

const characterSets: CharacterSet[] = [
  'light',
  'boxes',
  'binaryBoxes',
  'binary',
  'binaryDirection',
  'steps',
  'intersect',
  'standard',
  'numbers',
  'custom',
]

type CharacterSet = keyof typeof predefinedCharacterSets | 'custom'

const gridOptions: GridType[] = ['none', 'horizontal', 'vertical', 'both']

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

  const handleCustomCharacterSetChange = (val: string) => {
    updateSettings({ characterSet: val })
    setSelectedCharSet('custom')
  }

  return (
    <Container>
      {sourceType !== 'code' && (
        <div>
          <InputSelect<CharacterSet>
            value={selectedCharSet as CharacterSet}
            onChange={handleCharacterSetChange}
            options={characterSets}
            labelize={(label) => label}
            placeholder="Select a character set"
          >
            Character Set
          </InputSelect>

          <div className="border-default mt-2 border-l py-1 pl-3">
            <InputText
              value={settings.characterSet}
              onChange={handleCustomCharacterSetChange}
              placeholder="Enter custom characters"
              className="[fontFamily:--font-mono]"
            />
          </div>
        </div>
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
