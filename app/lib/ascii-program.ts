/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import type { Program } from './animation'
import type { Data } from './types'

export async function createImageAsciiProgram(
  asciiData: Data = {},
  width = 80,
  height = 40,
  frames?: Data[],
  frameRate: number = 30,
): Promise<Program> {
  const w = Math.max(1, width)
  const h = Math.max(1, height)

  // Default program
  const program: Program = {
    settings: {
      fps: frameRate,
      cols: w,
      rows: h,
    },

    boot: (_context, _buffer, userData) => {
      userData.asciiData = asciiData

      // If we have animation frames, store them
      if (frames && frames.length > 0) {
        userData.frames = frames
        userData.isAnimated = true
        userData.frameCount = frames.length
      }
    },

    main: (pos, context, _cursor, _buffer, userData) => {
      const { x, y } = pos

      // If we have animation frames, use the current frame based on context.frame
      if (userData.isAnimated && userData.frames) {
        const frameIndex = context.frame % userData.frameCount
        const currentFrame = userData.frames[frameIndex]

        if (currentFrame && currentFrame[x] && currentFrame[x][y]) {
          return {
            char: currentFrame[x][y].char || ' ',
          }
        }
      }
      // Otherwise use the static data
      else if (userData.asciiData && userData.asciiData[x] && userData.asciiData[x][y]) {
        return {
          char: userData.asciiData[x][y].char || ' ',
        }
      }

      return {
        char: ' ',
      }
    },
  }

  return program
}

export async function createCodeAsciiProgram(
  width: number,
  height: number,
  frameRate: number,
  programModuleLoader: { load: () => Promise<Program> },
): Promise<Program | null> {
  const w = Math.max(1, width)
  const h = Math.max(1, height)

  let programModule = null
  if (typeof programModuleLoader.load === 'function') {
    try {
      programModule = await programModuleLoader.load()
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
      fps: frameRate,
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
