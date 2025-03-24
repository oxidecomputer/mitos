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
        allowSelect: true,
        element: asciiEl.current,
        once: true,
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
      className="ascii-animation relative flex items-center justify-center"
      aria-hidden
      role="img"
    >
      <pre
        ref={asciiEl}
        className="relative m-0 whitespace-pre bg-[transparent] p-0 font-mono text-xs leading-[1.2] text-black"
        style={{ fontFamily: '"GT America Mono",monospace', fontSize: '12px' }}
      />
    </div>
  )
}
