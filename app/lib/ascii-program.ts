/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

/**
 * Unified ASCII Program Generator
 *
 * This module provides a unified approach for creating ASCII art programs
 * from both images and code. All programs are processed through the same
 * pipeline using esbuild-wasm.
 *
 * Example usage:
 *
 * // For image data:
 * const imageProgram = await createUnifiedImageProgram(
 *   imageData,     // ImageData with 0-1 values
 *   80, 40,        // width, height
 *   frames,        // optional animation frames
 *   30,            // frame rate
 *   { esbuildService }
 * )
 *
 * // For code:
 * const codeProgram = await createUnifiedCodeProgram(
 *   userCode,      // string containing main/boot/pre/post functions
 *   80, 40,        // width, height
 *   30,            // frame rate
 *   { esbuildService }
 * )
 *
 * // The generated code can import:
 * // import { valueToChar, getImageValue } from '@/utils'
 * // import { imageData, frames } from '@/imageData'
 */
import type { Program } from './animation'
import { processCodeModule, type CodeProcessorOptions } from './code-processor'
import type { AsciiImageData } from './types'

export function generateImageCode(): string {
  return `
import { valueToChar, getImageValue } from '@/utils'
import { imageData, frames } from '@/imageData'
import { characterSet } from '@/settings'

const isAnimated = frames !== null && frames !== undefined
const frameCount = isAnimated ? frames.length : 0

function main(pos, context) {
  const { x, y } = pos

  let value = 0

  if (isAnimated && frames) {
    const frameIndex = context.frame % frameCount
    const currentFrame = frames[frameIndex]
    value = getImageValue(currentFrame, x, y)
  } else {
    value = getImageValue(imageData, x, y)
  }

  return {
    char: valueToChar(value, characterSet)
  }
}
`.trim()
}

/**
 * Unified function to process any program (image or code)
 */
export async function processProgram(
  input:
    | {
        type: 'image'
        imageData?: AsciiImageData
        frames?: AsciiImageData[]
        width?: number
        height?: number
        frameRate?: number
      }
    | {
        type: 'code'
        code: string
        width?: number
        height?: number
        frameRate?: number
      },
  options: CodeProcessorOptions,
) {
  const width = Math.max(1, input.width || 80)
  const height = Math.max(1, input.height || 40)
  const frameRate = input.frameRate || 30

  let code: string

  if (input.type === 'image') {
    const imageDataInput = input.imageData || {}
    const framesInput = input.frames

    code = generateImageCode(imageDataInput, framesInput, frameRate)
  } else {
    code = input.code
  }

  // Pass image data to processor options
  const processorOptions = {
    ...options,
    imageData: input.type === 'image' ? input.imageData : undefined,
    frames: input.type === 'image' ? input.frames : undefined,
  }

  const result = await processCodeModule(code, processorOptions)

  return {
    ...result,
    settings: {
      width,
      height,
      frameRate,
    },
  }
}

/**
 * Creates a program from the unified processor result
 */
export async function createProgramFromProcessor(
  processorResult: Awaited<ReturnType<typeof processProgram>>,
): Promise<Program | null> {
  if (!processorResult.success || !processorResult.module) {
    return null
  }

  const { settings } = processorResult
  const w = Math.max(1, settings.width)
  const h = Math.max(1, settings.height)

  let programModule = null
  if (typeof processorResult.module.load === 'function') {
    try {
      programModule = await processorResult.module.load()
    } catch (error) {
      console.error('Failed to load program module:', error)
      return null
    }
  }

  // Check if we have a valid programModule with exported functions
  const hasCustomProgram =
    programModule &&
    (typeof programModule.main === 'function' ||
      typeof programModule.boot === 'function' ||
      typeof programModule.pre === 'function' ||
      typeof programModule.post === 'function')

  // Default program
  const program: Program = {
    settings: {
      fps: settings.frameRate,
      cols: w,
      rows: h,
    },

    boot: (_context, _buffer, userData) => {
      if (hasCustomProgram && programModule && typeof programModule.boot === 'function') {
        try {
          programModule.boot(_context, _buffer, userData)
        } catch (error) {
          console.error('Error in custom boot function:', error)
        }
      }
    },

    main: (pos, context, cursor, buffer, userData) => {
      if (hasCustomProgram && programModule && typeof programModule.main === 'function') {
        try {
          const result = programModule.main(pos, context, cursor, buffer, userData)
          if (result) return result
        } catch (error) {
          console.error('Error in custom main function:', error)
        }
      }

      // Fallback
      return {
        char: ' ',
      }
    },
  }

  // Add pre function if available
  if (hasCustomProgram && programModule && typeof programModule.pre === 'function') {
    program.pre = (context, cursor, buffer, userData) => {
      try {
        if (programModule && programModule.pre) {
          programModule.pre(context, cursor, buffer, userData)
        }
      } catch (error) {
        console.error('Error in custom pre function:', error)
      }
    }
  }

  // Add post function if available
  if (hasCustomProgram && programModule && typeof programModule.post === 'function') {
    program.post = (context, cursor, buffer, userData) => {
      try {
        if (programModule && programModule.post) {
          programModule.post(context, cursor, buffer, userData)
        }
      } catch (error) {
        console.error('Error in custom post function:', error)
      }
    }
  }

  return program
}

/**
 * Creates a program directly from image data using the unified approach
 */
export async function createUnifiedImageProgram(
  imageData: AsciiImageData,
  width: number,
  height: number,
  frames: AsciiImageData[] | undefined,
  frameRate: number,
  options: CodeProcessorOptions,
): Promise<{ program: Program | null; code: string }> {
  const result = await processProgram(
    {
      type: 'image',
      imageData,
      frames,
      width,
      height,
      frameRate,
    },
    options,
  )

  const code = generateImageCode(imageData, frames, frameRate)
  const program = await createProgramFromProcessor(result)

  return { program, code }
}

/**
 * Creates a program directly from code using the unified approach
 */
export async function createUnifiedCodeProgram(
  code: string,
  width: number,
  height: number,
  frameRate: number,
  options: CodeProcessorOptions,
): Promise<{ program: Program | null; code: string }> {
  const result = await processProgram(
    {
      type: 'code',
      code,
      width,
      height,
      frameRate,
    },
    options,
  )

  const program = await createProgramFromProcessor(result)

  return { program, code }
}

export async function createImageAsciiProgram(
  imageData: AsciiImageData,
  width: number,
  height: number,
  frames: AsciiImageData[] | undefined,
  frameRate: number,
  options: CodeProcessorOptions,
): Promise<{ program: Program | null; code: string }> {
  return createUnifiedImageProgram(imageData, width, height, frames, frameRate, options)
}
