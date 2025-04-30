/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { DitheringAlgorithm } from '~/lib/image-processor'
import { InputSwitch } from '~/lib/ui/src'
import { InputNumber } from '~/lib/ui/src/components/InputNumber/InputNumber'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'

import { Container } from './container'

interface PreprocessingOptionsProps {
  settings: {
    brightness: number
    whitePoint: number
    blackPoint: number
    blur: number
    invert: boolean
    dithering: boolean
    ditheringAlgorithm: DitheringAlgorithm
  }
  updateSettings: (
    settings: Partial<{
      brightness: number
      whitePoint: number
      blackPoint: number
      blur: number
      invert: boolean
      dithering: boolean
      ditheringAlgorithm: DitheringAlgorithm
    }>,
  ) => void
}

export function PreprocessingOptions({
  settings,
  updateSettings,
}: PreprocessingOptionsProps) {
  return (
    <Container>
      <InputNumber
        min={-255}
        max={255}
        value={settings.brightness}
        onChange={(value) => updateSettings({ brightness: value })}
      >
        Brightness
      </InputNumber>

      <InputNumber
        min={0}
        max={255}
        value={settings.whitePoint}
        onChange={(value) => updateSettings({ whitePoint: value })}
      >
        White point
      </InputNumber>

      <InputNumber
        min={0}
        max={255}
        value={settings.blackPoint}
        onChange={(value) => updateSettings({ blackPoint: value })}
      >
        Black point
      </InputNumber>

      <InputNumber
        min={0}
        max={20}
        step={0.1}
        value={settings.blur}
        onChange={(value) => updateSettings({ blur: value })}
      >
        Blur
      </InputNumber>

      <InputSwitch
        checked={settings.invert}
        onChange={(checked) => updateSettings({ invert: checked })}
      >
        Invert Colors
      </InputSwitch>

      <InputSwitch
        checked={settings.dithering}
        onChange={(checked) => updateSettings({ dithering: checked })}
      >
        Dithering
      </InputSwitch>

      {settings.dithering && (
        <div className="dedent">
          <InputSelect
            value={settings.ditheringAlgorithm}
            onChange={(value) =>
              updateSettings({ ditheringAlgorithm: value as DitheringAlgorithm })
            }
            options={['floydSteinberg', 'atkinson', 'ordered', 'bayer']}
            labelize={(algorithm) => {
              switch (algorithm) {
                case 'floydSteinberg':
                  return 'Floyd-Steinberg'
                case 'atkinson':
                  return 'Atkinson'
                case 'ordered':
                  return 'Ordered'
                case 'bayer':
                  return 'Bayer'
                default:
                  return algorithm
              }
            }}
          >
            Dithering Algorithm
          </InputSelect>
        </div>
      )}
    </Container>
  )
}
