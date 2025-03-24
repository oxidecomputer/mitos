import type { Program } from './animation'
import type { Data } from './types'

export async function createImageAsciiProgram(
  asciiData: Data = {},
  width = 80,
  height = 40,
): Promise<Program> {
  width = Math.max(1, width)
  height = Math.max(1, height)

  // Default program
  const program: Program = {
    settings: {
      fps: 30,
      cols: width,
      rows: height,
      color: '#000000',
      backgroundColor: '#ffffff',
    },

    boot: (_context, _buffer, userData) => {
      userData.asciiData = asciiData
    },

    main: (pos, _context, _cursor, _buffer, userData) => {
      const { x, y } = pos

      if (userData.asciiData && userData.asciiData[x] && userData.asciiData[x][y]) {
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
  width = 80,
  height = 40,
  programModuleLoader?: { load: () => Promise<any> },
): Promise<Program> {
  width = Math.max(1, width)
  height = Math.max(1, height)

  // Load the module if provided
  let programModule = null
  if (programModuleLoader && typeof programModuleLoader.load === 'function') {
    try {
      programModule = await programModuleLoader.load()
    } catch (error) {
      console.error('Failed to load program module:', error)
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
      fps: 30,
      cols: width,
      rows: height,
      color: '#000000',
      backgroundColor: '#ffffff',
    },

    boot: (_context, _buffer, userData) => {
      if (hasCustomProgram && typeof programModule.boot === 'function') {
        try {
          programModule.boot(_context, _buffer, userData)
        } catch (error) {
          console.error('Error in custom boot function:', error)
        }
      }
    },

    main: (pos, context, cursor, buffer, userData) => {
      if (hasCustomProgram && typeof programModule.main === 'function') {
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
  if (hasCustomProgram && typeof programModule.pre === 'function') {
    program.pre = (context, cursor, buffer, userData) => {
      try {
        programModule.pre(context, cursor, buffer, userData)
      } catch (error) {
        console.error('Error in custom pre function:', error)
      }
    }
  }

  // Add post function if available
  if (hasCustomProgram && typeof programModule.post === 'function') {
    program.post = (context, cursor, buffer, userData) => {
      try {
        programModule.post(context, cursor, buffer, userData)
      } catch (error) {
        console.error('Error in custom post function:', error)
      }
    }
  }

  return program
}
