/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import type { AsciiSettings } from '~/components/ascii-art-generator'

import type { Data } from './types'

// Types
export interface CachedMediaData {
  type: 'gif' | 'video'
  sourceUrl: string
  rawFrames: MediaFrame[]
  processedFrames?: {
    settings: MediaProcessingSettings
    frames: Data[]
  }
}

interface MediaFrame {
  dataUrl: string
  timestamp?: number
}

interface MediaProcessingSettings {
  characterSet: string
  whitePoint: number
  blackPoint: number
  brightness: number
  invert: boolean
  dithering: boolean
  ditheringAlgorithm: string
  columns: number
  rows: number
  colorMapping: string
}

interface ProcessingResult {
  data: Data
  width: number
  height: number
  processedImageUrl?: string
  frames?: Data[]
  rawFrames?: MediaFrame[]
  frameCount?: number
  sourceFps?: number
}

// Main processing functions
export async function processAnimatedMedia(
  rawFrames: MediaFrame[],
  settings: AsciiSettings,
  progressCallback?: (frame: number) => void,
): Promise<{
  frames: Data[]
  firstFrameData: Data
  firstFrameUrl: string | null
}> {
  const processedFrames: Data[] = []
  let firstFrameData: Data = {}
  let firstFrameUrl: string | null = null

  for (let i = 0; i < rawFrames.length; i++) {
    if (progressCallback) {
      progressCallback(i)
    }

    const frameResult = await processImage(rawFrames[i].dataUrl, settings)

    if (i === 0) {
      firstFrameData = frameResult.data
      firstFrameUrl = frameResult.processedImageUrl || null
    }

    processedFrames.push(frameResult.data)
  }

  return {
    frames: processedFrames,
    firstFrameData,
    firstFrameUrl,
  }
}

export async function processImage(
  imageData: string,
  settings: AsciiSettings,
  extractFrames: boolean = false,
): Promise<ProcessingResult> {
  return new Promise((resolve) => {
    if (extractFrames && settings.source.type === 'gif') {
      handleGifExtraction(imageData, settings, resolve)
      return
    }

    const img = new Image()

    img.onload = async () => {
      const width = settings.output.columns
      const height = settings.output.rows

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      canvas.width = img.width
      canvas.height = img.height

      ctx.drawImage(img, 0, 0)

      const result = await processImageData(canvas, settings)

      resolve({
        data: result.data,
        width,
        height,
        processedImageUrl: result.processedImageUrl,
      })
    }

    img.onerror = (error) => {
      console.error('Error loading image:', error)
      resolve(createFallbackResponse(settings))
    }

    img.src = imageData
  })
}

// Helper functions
function createFallbackResponse(settings: AsciiSettings): ProcessingResult {
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

  return { data, width, height }
}

async function processImageData(
  sourceCanvas: HTMLCanvasElement,
  settings: AsciiSettings,
): Promise<{
  data: Data
  processedImageUrl?: string
}> {
  const ctx = sourceCanvas.getContext('2d')!
  const width = settings.output.columns
  const height = settings.output.rows

  // Apply preprocessing
  applyImagePreprocessing(ctx, settings.preprocessing)

  // Resize for ASCII conversion
  const resizeCanvas = document.createElement('canvas')
  const resizeCtx = resizeCanvas.getContext('2d')!

  resizeCanvas.width = width
  resizeCanvas.height = height

  configureResizeContext(resizeCtx, settings.preprocessing.blur)

  // Apply center-pixel sampling for better resizing
  const srcWidth = sourceCanvas.width
  const srcHeight = sourceCanvas.height
  const pixelWidth = srcWidth / width
  const pixelHeight = srcHeight / height
  const offsetX = pixelWidth / 2
  const offsetY = pixelHeight / 2

  resizeCtx.drawImage(
    sourceCanvas,
    offsetX,
    offsetY,
    srcWidth - offsetX * 2,
    srcHeight - offsetY * 2,
    0,
    0,
    width,
    height,
  )

  const processedImageUrl = resizeCanvas.toDataURL('image/png')
  const pixelData = resizeCtx.getImageData(0, 0, width, height).data
  const data = convertPixelsToAscii(pixelData, width, height, settings)

  return { data, processedImageUrl }
}

function applyImagePreprocessing(
  ctx: CanvasRenderingContext2D,
  preprocessing: AsciiSettings['preprocessing'],
) {
  // Apply brightness
  if (preprocessing.brightness !== 0) {
    adjustBrightness(ctx, preprocessing.brightness)
  }

  // Apply inversion
  if (preprocessing.invert) {
    invertColors(ctx)
  }

  // Apply dithering
  if (preprocessing.dithering) {
    applyDithering(ctx, preprocessing.ditheringAlgorithm)
  }
}

function configureResizeContext(ctx: CanvasRenderingContext2D, blur: number) {
  if (blur > 0) {
    ctx.filter = `blur(${blur}px)`
  } else {
    ctx.filter = 'none'
  }
  ctx.imageSmoothingEnabled = false
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0,
    s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return [h * 360, s * 100, l * 100]
}

function convertPixelsToAscii(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: AsciiSettings,
): Data {
  const characterSet = settings.output.characterSet
  const colorMapping = settings.output.colorMapping

  const data: Data = {}

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4

      // Get pixel color values
      const r = pixelData[pixelIndex]
      const g = pixelData[pixelIndex + 1]
      const b = pixelData[pixelIndex + 2]

      let mappingValue = 0

      switch (colorMapping) {
        case 'hue': {
          const [h, _, __] = rgbToHsl(r, g, b)
          mappingValue = (h / 360) * 255 // Map hue (0-360) to 0-255 range
          break
        }
        case 'saturation': {
          const [_, s, __] = rgbToHsl(r, g, b)
          mappingValue = (s / 100) * 255 // Map saturation (0-100) to 0-255 range
          break
        }
        case 'brightness':
        default:
          // Use luminance formula for brightness
          mappingValue = 0.299 * r + 0.587 * g + 0.114 * b
          break
      }

      mappingValue = normalizeWithPointAdjustment(
        mappingValue,
        settings.preprocessing.blackPoint,
        settings.preprocessing.whitePoint,
      )

      // Map to character
      const charIndex = Math.floor((mappingValue / 255) * (characterSet.length - 1))
      const char = characterSet[charIndex] || ' '

      // Initialize column if needed
      if (!data[x]) {
        data[x] = {}
      }

      data[x][y] = {
        char,
        color: '#000000',
      }
    }
  }

  return data
}

function normalizeWithPointAdjustment(
  value: number,
  blackPoint: number,
  whitePoint: number,
): number {
  const range = whitePoint - blackPoint
  if (range <= 0) return value

  value = Math.max(0, value - blackPoint)
  value = Math.min(255, value)
  return (value / range) * 255
}

// Image processing utilities
export function adjustBrightness(ctx: CanvasRenderingContext2D, brightness: number) {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const data = imageData.data
  const factor = brightness < 0 ? 1 + brightness / 100 : 1 + brightness / 50

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * factor)
    data[i + 1] = Math.min(255, data[i + 1] * factor)
    data[i + 2] = Math.min(255, data[i + 2] * factor)
  }

  ctx.putImageData(imageData, 0, 0)
}

export function invertColors(ctx: CanvasRenderingContext2D) {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]
    data[i + 1] = 255 - data[i + 1]
    data[i + 2] = 255 - data[i + 2]
  }

  ctx.putImageData(imageData, 0, 0)
}

export function applyDithering(
  ctx: CanvasRenderingContext2D,
  algorithm: string = 'floydSteinberg',
) {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const data = imageData.data
  const width = ctx.canvas.width
  const height = ctx.canvas.height

  const ditheringAlgorithms = {
    floydSteinberg: applyFloydSteinberg,
    atkinson: applyAtkinson,
    ordered: applyOrdered,
    bayer: applyBayer,
  }

  const selectedAlgorithm =
    ditheringAlgorithms[algorithm as keyof typeof ditheringAlgorithms] ||
    ditheringAlgorithms.floydSteinberg

  selectedAlgorithm(data, width, height)
  ctx.putImageData(imageData, 0, 0)
}

// Dithering algorithm implementations
function applyFloydSteinberg(data: Uint8ClampedArray, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      // Convert to grayscale
      const oldGray = Math.round(
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
      )
      const newGray = oldGray < 128 ? 0 : 255
      const error = oldGray - newGray

      // Set new pixel value
      data[idx] = newGray
      data[idx + 1] = newGray
      data[idx + 2] = newGray

      // Distribute error to neighboring pixels
      distributeError(data, width, height, x, y, error, [
        { dx: 1, dy: 0, factor: 7 / 16 },
        { dx: -1, dy: 1, factor: 3 / 16 },
        { dx: 0, dy: 1, factor: 5 / 16 },
        { dx: 1, dy: 1, factor: 1 / 16 },
      ])
    }
  }
}

function applyAtkinson(data: Uint8ClampedArray, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      // Convert to grayscale
      const oldGray = Math.round(
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
      )
      const newGray = oldGray < 128 ? 0 : 255
      const error = Math.floor((oldGray - newGray) / 8)

      // Set new pixel value
      data[idx] = newGray
      data[idx + 1] = newGray
      data[idx + 2] = newGray

      // Distribute error to neighboring pixels
      distributeError(data, width, height, x, y, error, [
        { dx: 1, dy: 0, factor: 1 },
        { dx: 2, dy: 0, factor: 1 },
        { dx: -1, dy: 1, factor: 1 },
        { dx: 0, dy: 1, factor: 1 },
        { dx: 1, dy: 1, factor: 1 },
        { dx: 0, dy: 2, factor: 1 },
      ])
    }
  }
}

function distributeError(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  error: number,
  distribution: { dx: number; dy: number; factor: number }[],
) {
  for (const { dx, dy, factor } of distribution) {
    const nx = x + dx
    const ny = y + dy

    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const nidx = (ny * width + nx) * 4
      const errorAmount = error * factor

      data[nidx] = Math.max(0, Math.min(255, data[nidx] + errorAmount))
      data[nidx + 1] = Math.max(0, Math.min(255, data[nidx + 1] + errorAmount))
      data[nidx + 2] = Math.max(0, Math.min(255, data[nidx + 2] + errorAmount))
    }
  }
}

// Other dithering algorithms...
function applyOrdered(data: Uint8ClampedArray, width: number, height: number) {
  const threshold = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const gray = Math.round(
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
      )

      const tx = x % 4
      const ty = y % 4
      const threshold_value = threshold[ty][tx] * 16

      const newGray = gray < threshold_value ? 0 : 255

      data[idx] = newGray
      data[idx + 1] = newGray
      data[idx + 2] = newGray
    }
  }
}

function applyBayer(data: Uint8ClampedArray, width: number, height: number) {
  // 8x8 Bayer matrix implementation
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
      const gray = Math.round(
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
      )

      const tx = x % 8
      const ty = y % 8
      const threshold = (bayerMatrix[ty][tx] / 64) * 255

      const newGray = gray < threshold ? 0 : 255

      data[idx] = newGray
      data[idx + 1] = newGray
      data[idx + 2] = newGray
    }
  }
}

// GIF handling
function handleGifExtraction(
  imageData: string,
  settings: AsciiSettings,
  resolve: (value: ProcessingResult) => void,
) {
  const img = new Image()
  img.onload = async () => {
    try {
      const initialFrame = await extractFirstGifFrame(img, settings)
      const frames = await extractMultipleGifFrames(img, initialFrame, settings)

      resolve({
        data: initialFrame.data,
        width: settings.output.columns,
        height: settings.output.rows,
        processedImageUrl: initialFrame.processedImageUrl,
        frames,
        frameCount: frames.length,
        sourceFps: 10, // Default assumption for GIFs
      })
    } catch (error) {
      console.error('Error processing GIF:', error)
      resolve(createFallbackResponse(settings))
    }
  }

  img.onerror = (error) => {
    console.error('Error loading GIF:', error)
    resolve(createFallbackResponse(settings))
  }

  img.src = imageData
}

async function extractFirstGifFrame(img: HTMLImageElement, settings: AsciiSettings) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  canvas.width = img.width
  canvas.height = img.height

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return await processImageData(canvas, settings)
}

async function extractMultipleGifFrames(
  img: HTMLImageElement,
  initialFrame: { data: Data; processedImageUrl?: string },
  settings: AsciiSettings,
): Promise<Data[]> {
  const frames: Data[] = [initialFrame.data]
  const totalFrames = Math.min(24, settings.animation.animationLength)

  try {
    for (let i = 1; i < totalFrames; i++) {
      const frameImg = new Image()
      frameImg.crossOrigin = 'Anonymous'

      const frameData = await loadGifFrame(frameImg, img, i, initialFrame, settings)

      if (frameData && Object.keys(frameData).length > 0) {
        frames.push(frameData)
      }
    }
  } catch (error) {
    console.error('Error extracting GIF frames:', error)
    // If extraction fails and we have no frames, create duplicates of first frame
    if (frames.length <= 1) {
      for (let i = 1; i < totalFrames; i++) {
        frames.push(JSON.parse(JSON.stringify(initialFrame.data)))
      }
    }
  }

  // Ensure we have at least one frame
  if (frames.length === 0) {
    frames.push(initialFrame.data)
  }

  return frames
}

async function loadGifFrame(
  frameImg: HTMLImageElement,
  originalImg: HTMLImageElement,
  frameIndex: number,
  initialFrame: { data: Data; processedImageUrl?: string },
  settings: AsciiSettings,
): Promise<Data> {
  return new Promise((resolveFrame) => {
    frameImg.onload = async () => {
      const frameCanvas = document.createElement('canvas')
      const frameCtx = frameCanvas.getContext('2d')

      if (!frameCtx) {
        resolveFrame({})
        return
      }

      frameCanvas.width = frameImg.width
      frameCanvas.height = frameImg.height

      frameCtx.drawImage(frameImg, 0, 0, frameCanvas.width, frameCanvas.height)

      const processed = await processImageData(frameCanvas, settings)
      resolveFrame(processed.data)
    }

    frameImg.onerror = () => {
      resolveFrame(initialFrame.data)
    }

    // Try to force browser to reload the image with cache bypass
    const cacheBuster = `?frame=${frameIndex}&t=${Date.now()}`
    frameImg.src = originalImg.src + cacheBuster
  })
}

// Code module processing
export function processCodeModule(code: string) {
  try {
    const wrappedCode = `
      ${code}
      return {
        main: typeof main === 'function' ? main : undefined,
        boot: typeof boot === 'function' ? boot : undefined,
        pre: typeof pre === 'function' ? pre : undefined,
        post: typeof post === 'function' ? post : undefined
      };
    `

    const moduleFn = new Function(wrappedCode)
    const moduleExports = moduleFn()

    return {
      async load() {
        return moduleExports
      },
    }
  } catch (error) {
    console.error('Error preparing user code module:', error)
    return null
  }
}
