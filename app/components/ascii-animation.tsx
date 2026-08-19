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
import { FONT_SIZE } from './dimension-utils'

export default function AsciiAnimation({
  program,
  onFrameUpdate = undefined,
  maxFrames,
  animationController,
  setAnimationController,
  textColor,
  backgroundColor,
  canvasBackgroundColor = backgroundColor,
  padding,
  lineHeight,
  children,
}: {
  program: Program
  onFrameUpdate?: (frame: number) => void
  maxFrames?: number
  animationController?: AnimationController
  setAnimationController: (controller: AnimationController) => void
  textColor: string
  backgroundColor: string
  // Background used to fill the canvas itself. Defaults to `backgroundColor`,
  // but can be set to 'transparent' so the underlying image (rendered behind
  // the canvas but in front of the container background) shows through.
  canvasBackgroundColor?: string
  padding: number
  lineHeight: number
  children: ReactNode
}) {
  const asciiEl = useRef<HTMLCanvasElement>(null)
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

      const width = Math.floor(element.offsetWidth)
      const height = Math.floor(element.offsetHeight)

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
        textColor,
        backgroundColor: canvasBackgroundColor,
        padding,
      })

      animController.togglePlay(wasPlaying)
      animController.setFrame(currentFrame)

      setAnimationController(animController)
    } catch (error) {
      console.error('Error creating animation controller:', error)
    }
  }, [
    program,
    maxFrames,
    onFrameUpdate,
    setAnimationController,
    textColor,
    canvasBackgroundColor,
    padding,
    lineHeight,
  ])

  return (
    <div
      ref={containerRef}
      className="ascii-animation relative flex items-center justify-center overflow-hidden rounded-[1%] [font-size:0px]"
      aria-hidden
      role="img"
      style={{
        backgroundColor,
      }}
    >
      <canvas
        ref={asciiEl}
        id="ascii-canvas"
        className="pointer-events-none relative z-10 m-0 select-none"
        style={{
          fontFamily: '"GT America Mono", monospace',
          fontSize: `${FONT_SIZE}px`,
          // calcMetrics reads the computed line-height off this element, so
          // the nudge flows through to the rendered cell height. Explicit px
          // keeps it exactly equal to the FONT_SIZE * lineHeight the export
          // dimension math uses, rather than whatever the browser resolves a
          // unitless value to
          lineHeight: `${FONT_SIZE * lineHeight}px`,
        }}
      />
      {children}
    </div>
  )
}
