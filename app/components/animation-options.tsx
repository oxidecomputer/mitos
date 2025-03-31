import { InputNumber } from '~/lib/ui/src'

import type { SourceType } from './ascii-art-generator'
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
  sourceType?: SourceType
}

export function AnimationOptions({
  settings,
  updateSettings,
  sourceType = 'code',
}: AnimationOptionsProps) {
  const isMediaSource = sourceType === 'gif' || sourceType === 'video'

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
