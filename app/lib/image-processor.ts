import type { AsciiSettings } from '~/components/ascii-art-generator'

import type { Data } from './types'

export async function processImage(
  imageData: string,
  settings: AsciiSettings,
): Promise<{
  data: Data
  width: number
  height: number
  processedImageUrl?: string
}> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Could not get canvas context')
      }

      // Use the custom columns and rows settings
      const width = settings.output.columns
      const height = settings.output.rows

      canvas.width = img.width
      canvas.height = img.height

      ctx.drawImage(img, 0, 0)

      // Apply brightness adjustment
      if (settings.preprocessing.brightness !== 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const brightness = settings.preprocessing.brightness
        const factor = brightness < 0 ? 1 + brightness / 100 : 1 + brightness / 50

        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * factor) // R
          data[i + 1] = Math.min(255, data[i + 1] * factor) // G
          data[i + 2] = Math.min(255, data[i + 2] * factor) // B
        }

        ctx.putImageData(imageData, 0, 0)
      }

      // Invert
      if (settings.preprocessing.invert) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i] // R
          data[i + 1] = 255 - data[i + 1] // G
          data[i + 2] = 255 - data[i + 2] // B
        }

        ctx.putImageData(imageData, 0, 0)
      }

      // Apply dithering
      if (settings.preprocessing.dithering) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const width = canvas.width
        const height = canvas.height

        // Apply the selected dithering algorithm
        switch (settings.preprocessing.ditheringAlgorithm) {
          case 'floydSteinberg':
            applyFloydSteinberg(data, width, height)
            break
          case 'atkinson':
            applyAtkinson(data, width, height)
            break
          case 'ordered':
            applyOrdered(data, width, height)
            break
          case 'bayer':
            applyBayer(data, width, height)
            break
          default:
            applyFloydSteinberg(data, width, height)
        }

        ctx.putImageData(imageData, 0, 0)
      }

      // Floyd-Steinberg error diffusion dithering
      function applyFloydSteinberg(data: Uint8ClampedArray, width: number, height: number) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4

            // Get current pixel values
            const oldR = data[idx]
            const oldG = data[idx + 1]
            const oldB = data[idx + 2]

            // Calculate grayscale value using luminance formula
            const oldGray = Math.round(0.299 * oldR + 0.587 * oldG + 0.114 * oldB)

            // Convert to black or white based on threshold (binary dithering)
            const newGray = oldGray < 128 ? 0 : 255

            // Calculate error
            const errorGray = oldGray - newGray

            // Set new pixel value
            data[idx] = newGray
            data[idx + 1] = newGray
            data[idx + 2] = newGray

            // Distribute error to neighboring pixels
            // Right pixel (7/16)
            if (x < width - 1) {
              const idx2 = idx + 4
              data[idx2] += (errorGray * 7) / 16
              data[idx2 + 1] += (errorGray * 7) / 16
              data[idx2 + 2] += (errorGray * 7) / 16
            }

            // Bottom-left pixel (3/16)
            if (x > 0 && y < height - 1) {
              const idx2 = idx + width * 4 - 4
              data[idx2] += (errorGray * 3) / 16
              data[idx2 + 1] += (errorGray * 3) / 16
              data[idx2 + 2] += (errorGray * 3) / 16
            }

            // Bottom pixel (5/16)
            if (y < height - 1) {
              const idx2 = idx + width * 4
              data[idx2] += (errorGray * 5) / 16
              data[idx2 + 1] += (errorGray * 5) / 16
              data[idx2 + 2] += (errorGray * 5) / 16
            }

            // Bottom-right pixel (1/16)
            if (x < width - 1 && y < height - 1) {
              const idx2 = idx + width * 4 + 4
              data[idx2] += (errorGray * 1) / 16
              data[idx2 + 1] += (errorGray * 1) / 16
              data[idx2 + 2] += (errorGray * 1) / 16
            }
          }
        }
      }

      // Atkinson dithering (popular for retro look)
      function applyAtkinson(data: Uint8ClampedArray, width: number, height: number) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4

            // Get current pixel values and convert to grayscale
            const oldGray = Math.round(
              0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
            )

            // Threshold and set the new pixel value
            const newGray = oldGray < 128 ? 0 : 255
            data[idx] = newGray
            data[idx + 1] = newGray
            data[idx + 2] = newGray

            // Calculate error
            const error = Math.floor((oldGray - newGray) / 8)

            // Distribute error to 6 neighboring pixels (each gets 1/8)
            const neighbors = [
              [1, 0], // right
              [2, 0], // two right
              [-1, 1], // bottom left
              [0, 1], // bottom
              [1, 1], // bottom right
              [0, 2], // two below
            ]

            for (const [dx, dy] of neighbors) {
              const nx = x + dx
              const ny = y + dy

              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = (ny * width + nx) * 4
                data[nidx] += error
                data[nidx + 1] += error
                data[nidx + 2] += error
              }
            }
          }
        }
      }

      // Ordered dithering (uses a pattern matrix for thresholding)
      function applyOrdered(data: Uint8ClampedArray, width: number, height: number) {
        // 4x4 Bayer matrix normalized to [0, 16]
        const threshold = [
          [0, 8, 2, 10],
          [12, 4, 14, 6],
          [3, 11, 1, 9],
          [15, 7, 13, 5],
        ]

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4

            // Get grayscale value
            const gray = Math.round(
              0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
            )

            // Get threshold value from the matrix (normalized to [0, 255])
            const tx = x % 4
            const ty = y % 4
            const threshold_value = threshold[ty][tx] * 16

            // Apply threshold
            const newGray = gray < threshold_value ? 0 : 255

            // Set pixel value
            data[idx] = newGray
            data[idx + 1] = newGray
            data[idx + 2] = newGray
          }
        }
      }

      // Bayer dithering (uses a larger pattern matrix)
      function applyBayer(data: Uint8ClampedArray, width: number, height: number) {
        // 8x8 Bayer matrix
        const bayerMatrix = [
          [0, 48, 12, 60, 3, 51, 15, 63],
          [32, 16, 44, 28, 35, 19, 47, 31],
          [8, 56, 4, 52, 11, 59, 7, 55],
          [40, 24, 36, 20, 43, 27, 39, 23],
          [2, 50, 14, 62, 1, 49, 13, 61],
          [34, 18, 46, 30, 33, 17, 45, 29],
          [10, 58, 6, 54, 9, 57, 5, 53],
          [42, 26, 38, 22, 41, 25, 37, 21],
        ]

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4

            // Get grayscale value
            const gray = Math.round(
              0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
            )

            // Get threshold from Bayer matrix (normalized to [0, 255])
            const tx = x % 8
            const ty = y % 8
            const threshold = (bayerMatrix[ty][tx] / 64) * 255

            // Apply threshold
            const newGray = gray < threshold ? 0 : 255

            // Set pixel value
            data[idx] = newGray
            data[idx + 1] = newGray
            data[idx + 2] = newGray
          }
        }
      }

      // Resize to target dimensions
      const resizeCanvas = document.createElement('canvas')
      const resizeCtx = resizeCanvas.getContext('2d')

      if (!resizeCtx) {
        throw new Error('Could not get resize canvas context')
      }

      resizeCanvas.width = width
      resizeCanvas.height = height

      // Apply blur if needed
      if (settings.preprocessing.blur > 0) {
        resizeCtx.filter = `blur(${settings.preprocessing.blur}px)`
      } else {
        resizeCtx.filter = 'none'
      }

      // Disable image smoothing for a pixelated effect
      resizeCtx.imageSmoothingEnabled = false

      // Calculate the sampling area to grab from the center of each pixel
      // This helps avoid edge sampling issues
      const srcWidth = canvas.width
      const srcHeight = canvas.height

      // Calculate pixel dimensions in source coordinates
      const pixelWidth = srcWidth / width
      const pixelHeight = srcHeight / height

      // Sample from the center of each pixel by offsetting by half pixel
      const offsetX = pixelWidth / 2
      const offsetY = pixelHeight / 2

      // Draw with center-pixel sampling
      // Use the full drawImage API to specify source and destination coordinates
      // This allows us to sample from the center of each pixel
      resizeCtx.drawImage(
        canvas,
        // Source coordinates - offset by half a pixel to sample from center
        offsetX,
        offsetY,
        // Source dimensions (slightly reduced to account for center sampling)
        srcWidth - offsetX * 2,
        srcHeight - offsetY * 2,
        // Destination coordinates
        0,
        0,
        // Destination dimensions
        width,
        height,
      )

      // Get the processed image URL for preview
      const processedImageUrl = resizeCanvas.toDataURL('image/png')

      // Get pixel data from resized image
      const pixelData = resizeCtx.getImageData(0, 0, width, height).data

      // Map pixels to ASCII characters
      const characterSet = settings.output.characterSet || '@%#*+=-:. '

      const data: Data = {}

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = (y * width + x) * 4

          // Calculate brightness using standard luminance formula
          const r = pixelData[pixelIndex]
          const g = pixelData[pixelIndex + 1]
          const b = pixelData[pixelIndex + 2]

          // Apply white/black point adjustments
          let brightness = 0.299 * r + 0.587 * g + 0.114 * b

          // Normalize brightness based on black/white points
          const range =
            settings.preprocessing.whitePoint - settings.preprocessing.blackPoint
          if (range > 0) {
            brightness = Math.max(0, brightness - settings.preprocessing.blackPoint)
            brightness = Math.min(255, brightness)
            brightness = (brightness / range) * 255
          }

          // Map brightness to character
          const charIndex = Math.floor((brightness / 255) * (characterSet.length - 1))
          const char = characterSet[characterSet.length - 1 - charIndex] || ' '

          // Initialize column if it doesn't exist
          if (!data[x]) {
            data[x] = {}
          }

          // Store the character
          data[x][y] = {
            char: char,
            color: '#000000', // Ensure text is black for visibility on white background
          }
        }
      }

      resolve({ data, width, height, processedImageUrl })
    }

    img.onerror = (error) => {
      console.error('Error loading image:', error)

      // Provide a fallback pattern if image loading fails
      const width = settings.output.columns || 80
      const height = settings.output.rows || 40
      const data: Data = {}

      for (let x = 0; x < width; x++) {
        data[x] = {}
        for (let y = 0; y < height; y++) {
          data[x][y] = {
            char: '?',
            color: '#000000',
          }
        }
      }

      // No processed image URL in error case
      resolve({ data, width, height })
    }

    img.src = imageData
  })
}

export function processCodeModule(code: string) {
  // Try to evaluate the code to extract exported functions
  let programModule = null
  try {
    // Create module from code using dynamic import
    const blob = new Blob([code], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)

    // Use import() to load the module (wrapped in a try/catch)
    programModule = {
      async load() {
        try {
          const module = await import(/* @vite-ignore */ url)
          URL.revokeObjectURL(url)
          return module
        } catch (err) {
          console.error('Error importing module:', err)
          URL.revokeObjectURL(url)
          return null
        }
      },
    }
  } catch (error) {
    console.error('Error preparing user code module:', error)
  }

  return programModule
}
