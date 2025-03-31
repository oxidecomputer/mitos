import { useEffect, useRef } from 'react'

import { createAnimation, type Program } from '~/lib/animation'

import { AnimationController } from './ascii-preview'

export default function AsciiAnimation({
  program,
  onFrameUpdate = undefined,
  maxFrames,
  animationController,
  setAnimationController,
}: {
  program: Program
  onFrameUpdate?: (frame: number) => void
  maxFrames?: number
  animationController?: AnimationController
  setAnimationController: (controller: AnimationController) => void
}) {
  const asciiEl = useRef<HTMLPreElement>(null)

  // Force re-initialization when component mounts or program changes
  useEffect(() => {
    if (!asciiEl.current) return

    // Clean up previous animation controller
    if (animationController) {
      animationController.cleanup()
      setAnimationController(null)
    }

    try {
      const animController = createAnimation(program, {
        element: asciiEl.current,
        onFrameUpdate: onFrameUpdate ? onFrameUpdate : undefined,
        maxFrames,
      })

      setAnimationController(animController)
    } catch (error) {
      console.error('Error creating animation controller:', error)
    }

    return function cleanup() {
      if (animationController) {
        animationController.cleanup()
      }
    }
  }, [program, maxFrames, onFrameUpdate])

  return (
    <div
      className="ascii-animation relative flex items-center justify-center [font-size:0px]"
      aria-hidden
      role="img"
    >
      <pre
        ref={asciiEl}
        className="pointer-events-none relative m-0 select-none whitespace-pre bg-[transparent] p-0 font-mono leading-[1.2]"
        style={{ fontFamily: '"GT America Mono",monospace', fontSize: '12px' }}
      />
    </div>
  )
}
