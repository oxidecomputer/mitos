import { useEffect, useRef, useState } from 'react'

import { createAnimation, type Program } from '~/lib/animation'

export default function AsciiAnimation({
  program,
  frame = 0,
  onFrameUpdate = undefined,
}: {
  program: Program
  frame?: number
  onFrameUpdate?: (frame: number) => void
}) {
  const asciiEl = useRef<HTMLPreElement>(null)
  const [animationController, setAnimationController] = useState<ReturnType<
    typeof createAnimation
  > | null>(null)

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
  }, [program])

  useEffect(() => {
    if (animationController && frame !== undefined) {
      animationController.setFrame(frame)
    }
  }, [frame, animationController])

  // useEffect(() => {
  //   if (animationController && onFrameUpdate) {
  //     animationController.onFrameChange = onFrameUpdate;
  //     return () => {
  //       if (animationController) {
  //         animationController.onFrameChange = undefined;
  //       }
  //     };
  //   }
  // }, [animationController, onFrameUpdate]);

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
