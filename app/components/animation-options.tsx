/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { InputNumber } from '~/lib/ui/src'

import { Container } from './container'

interface AnimationOptionsProps {
  settings: {
    animationLength: number
    frameRate: number
  }
  updateSettings: (
    settings: Partial<{
      animationLength: number
      frameRate: number
    }>,
  ) => void
}

export function AnimationOptions({ settings, updateSettings }: AnimationOptionsProps) {
  const isMediaSource = false // Always show all options since we unified the approach

  return (
    <Container>
      <InputNumber
        min={1}
        value={settings.animationLength}
        onChange={(val) => updateSettings({ animationLength: val })}
        disabled={isMediaSource}
      >
        Animation Length
      </InputNumber>

      <InputNumber
        min={1}
        max={60}
        value={settings.frameRate}
        onChange={(val) => updateSettings({ frameRate: val })}
      >
        Frame Rate (FPS)
      </InputNumber>
    </Container>
  )
}
