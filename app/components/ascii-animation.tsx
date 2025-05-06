/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useEffect, useRef, type ReactNode } from 'react'

import { createAnimation, type Program } from '~/lib/animation'

import { AnimationController } from './ascii-preview'

export default function AsciiAnimation({
  program,
  onFrameUpdate = undefined,
  maxFrames,
  animationController,
  setAnimationController,
  textColor,
  backgroundColor,
  padding,
  children,
}: {
  program: Program
  onFrameUpdate?: (frame: number) => void
  maxFrames?: number
  animationController?: AnimationController
  setAnimationController: (controller: AnimationController) => void
  textColor: string
  backgroundColor: string
  padding: number
  children: ReactNode
}) {
  const asciiEl = useRef<HTMLPreElement>(null)
  const controllerRef = useRef(animationController)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !asciiEl.current) return

    // Function to snap container dimensions to whole numbers
    // Helps avoid adding extra white lines to the space between container
    // and exported asset
    const snapContainerDimensions = () => {
      const container = containerRef.current
      const element = asciiEl.current
      if (!container || !element) return

      const width = Math.floor(element.offsetWidth + padding * 2)
      const height = Math.floor(element.offsetHeight + padding * 2)

      container.style.width = `${width}px`
      container.style.height = `${height}px`
    }

    snapContainerDimensions()

    // Create ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(() => {
      snapContainerDimensions()
    })

    resizeObserver.observe(asciiEl.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [padding])

  useEffect(() => {
    controllerRef.current = animationController
  }, [animationController])

  // Force re-initialization when component mounts or program changes
  useEffect(() => {
    if (!asciiEl.current) return

    // Use the ref to access the current controller
    const currentController = controllerRef.current

    const wasPlaying = currentController ? currentController.getState().playing : false
    const currentFrame = currentController ? currentController.getState().frame : 0

    // Clean up previous animation controller
    if (currentController) {
      currentController.cleanup()
      setAnimationController(null)
    }

    try {
      const animController = createAnimation(program, {
        element: asciiEl.current,
        onFrameUpdate: onFrameUpdate ? onFrameUpdate : undefined,
        maxFrames,
      })

      animController.togglePlay(wasPlaying)
      animController.setFrame(currentFrame)

      setAnimationController(animController)
    } catch (error) {
      console.error('Error creating animation controller:', error)
    }
  }, [program, maxFrames, onFrameUpdate, setAnimationController])

  return (
    <div
      ref={containerRef}
      className="ascii-animation relative flex items-center justify-center [font-size:0px]"
      aria-hidden
      role="img"
      style={{
        backgroundColor,
        padding,
      }}
    >
      <pre
        ref={asciiEl}
        className="z-1 pointer-events-none relative m-0 select-none whitespace-pre p-0 font-mono leading-[1.2]"
        style={{
          fontFamily: '"GT America Mono",monospace',
          fontSize: '12px',
          color: textColor,
        }}
      />
      {children}
    </div>
  )
}
