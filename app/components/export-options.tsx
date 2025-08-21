/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useState } from 'react'

import { InputNumber, InputSwitch } from '~/lib/ui/src'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'
import { InputText } from '~/lib/ui/src/components/InputText/InputText'
import { DEFAULT_SETTINGS } from '~/templates'

import { Container } from './container'

interface ExportOptionsProps {
  settings: {
    textColor: string
    backgroundColor: string
    padding: number
  }
  updateSettings: (
    settings: Partial<{
      textColor: string
      backgroundColor: string
      padding: number
    }>,
  ) => void
}

export const predefinedColorSets = {
  default: [DEFAULT_SETTINGS.export.textColor, DEFAULT_SETTINGS.export.backgroundColor],
  green: ['#48d597', '#1c372e'],
  yellow: ['#f5b944', '#3d3019'],
  red: ['#fb6e88', '#301b1d'],
  blue: ['#8Ba1FF', '#2d3048'],
  purple: ['#be95eb', '#382d43'],
}

const characterSets: ColorSet[] = [
  'default',
  'green',
  'yellow',
  'red',
  'blue',
  'purple',
  'custom',
]

type ColorSet = keyof typeof predefinedColorSets | 'custom'

export function ExportOptions({ settings, updateSettings }: ExportOptionsProps) {
  const [selectedColorSet, setSelectedColorSet] = useState('default')
  const [flipped, setFlipped] = useState(false)

  const handleColorSetChange = (value: string) => {
    setSelectedColorSet(value)
    if (value === 'custom') return

    let [textColor, backgroundColor] =
      predefinedColorSets[value as keyof typeof predefinedColorSets]

    if (flipped) {
      const temp = textColor
      textColor = backgroundColor
      backgroundColor = temp
    }

    updateSettings({
      textColor,
      backgroundColor,
    })
  }

  const handleCustomColorSetChange = (
    property: 'textColor' | 'backgroundColor',
    val: string,
  ) => {
    updateSettings({ [property]: val })
    setSelectedColorSet('custom')
  }

  const handleFlipColors = (checked: boolean) => {
    setFlipped(checked)

    const newTextColor = settings.backgroundColor
    const newBackgroundColor = settings.textColor

    updateSettings({
      textColor: newTextColor,
      backgroundColor: newBackgroundColor,
    })

    if (selectedColorSet !== 'custom') {
      setSelectedColorSet(selectedColorSet)
    }
  }

  return (
    <Container>
      <InputSelect<ColorSet>
        value={selectedColorSet as ColorSet}
        onChange={handleColorSetChange}
        options={characterSets}
        labelize={(label) => label}
        placeholder="Select a color set"
      >
        Color Set
      </InputSelect>

      <div className="dedent">
        <div className="flex gap-2">
          <InputText
            value={flipped ? settings.textColor : settings.backgroundColor}
            onChange={(val) =>
              handleCustomColorSetChange(flipped ? 'textColor' : 'backgroundColor', val)
            }
          >
            {flipped ? 'Text color' : 'BG color'}
          </InputText>
          <InputText
            value={flipped ? settings.backgroundColor : settings.textColor}
            onChange={(val) =>
              handleCustomColorSetChange(flipped ? 'backgroundColor' : 'textColor', val)
            }
          >
            {flipped ? 'BG color' : 'Text color'}
          </InputText>
        </div>
        <InputSwitch checked={flipped} onChange={handleFlipColors}>
          Flip Colors
        </InputSwitch>
      </div>
      <InputNumber
        min={0}
        max={20}
        value={settings.padding}
        onChange={(val) => updateSettings({ padding: val })}
      >
        Padding
      </InputNumber>
    </Container>
  )
}
