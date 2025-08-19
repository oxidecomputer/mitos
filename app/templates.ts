/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { AsciiSettings } from './components/ascii-art-generator'
import { predefinedCharacterSets } from './components/output-options'
import { exampleImage } from './exampleImage'
import { clock } from './scripts/clock'
import { coins } from './scripts/coins'
import { numbers } from './scripts/numbers'
import { unpkgDemo } from './scripts/unpkg-demo'

export const DEFAULT_CODE = `/**
@author ertdfgcvb
@url https://play.ertdfgcvb.xyz/#/src/basics/time_milliseconds
*/
import { characterSet } from '@/settings'

const speed = 1; //~ number 0-10 step=0.5
const amplitude = 18; //~ number 1-50

// Renders each cell
function main(coord, context, cursor, buffer) {
  const t = context.frame * 0.01 * speed
  const x = coord.x
  const y = coord.y
  const o = Math.sin(y * Math.sin(t) * 0.2 + x * 0.04 + t) * amplitude
  const i = Math.round(Math.abs(x + y + o)) % characterSet.length
  return characterSet[i]
}

// Optional: Runs once at startup
function boot(context, buffer, userData) {}

// Optional: Runs at the start of each frame
function pre(context, cursor, buffer, userData) {}

// Optional: Runs after each frame is complete
function post(context, cursor, buffer, userData) {}`

export const DEFAULT_SETTINGS: AsciiSettings = {
  meta: { name: 'Default' },
  source: {
    data: null,
    code: '',
    fileName: '',
  },
  preprocessing: {
    brightness: 0,
    whitePoint: 255,
    blackPoint: 0,
    blur: 0,
    invert: false,
    dithering: false,
    ditheringAlgorithm: 'floydSteinberg',
  },
  output: {
    characterSet: predefinedCharacterSets['standard'],
    grid: 'none',
    showUnderlyingImage: false,
    columns: 80,
    rows: 40,
    useImageAspectRatio: false,
    colorMapping: 'brightness',
  },
  export: {
    textColor: '#d7d8d9',
    backgroundColor: '#080f11',
    padding: 2,
  },
  animation: {
    animationLength: 100,
    frameRate: 30,
  },
}

export const TEMPLATES = {
  default: DEFAULT_SETTINGS,
  custom: { ...DEFAULT_SETTINGS, meta: { name: 'Custom Project' } },
  clock: {
    ...DEFAULT_SETTINGS,
    meta: { name: 'Clock' },
    source: { data: null, code: clock },
    output: { ...DEFAULT_SETTINGS, columns: 61, rows: 9, grid: 'both' },
    animation: {
      animationLength: 900,
      frameRate: 15,
    },
  },
  numbers: {
    ...DEFAULT_SETTINGS,
    meta: { name: 'Numbers' },
    source: { data: null, code: numbers },
    output: { ...DEFAULT_SETTINGS, columns: 98, rows: 9, grid: 'both' },
    animation: {
      animationLength: 1,
      frameRate: 1,
    },
  },
  coins: {
    ...DEFAULT_SETTINGS,
    meta: { name: 'Coins' },
    source: { data: null, code: coins },
    output: { ...DEFAULT_SETTINGS, columns: 120, rows: 40, grid: 'none' },
    animation: {
      animationLength: 100,
      frameRate: 30,
    },
  },
  unpkgDemo: {
    ...DEFAULT_SETTINGS,
    meta: { name: 'Perlin Noise (Unpkg)' },
    source: { data: null, code: unpkgDemo },
    output: { ...DEFAULT_SETTINGS, columns: 80, rows: 40, grid: 'none' },
    animation: {
      animationLength: 300,
      frameRate: 30,
    },
  },
  localPattern: {
    ...DEFAULT_SETTINGS,
    meta: { name: 'Local Pattern' },
    source: {
      data: null,
      code: `import { checkerboard } from '@/utils'

function main(coord, context, cursor, buffer) {
  const value = checkerboard(coord.x, coord.y, 4)
  return value === 1 ? '█' : ' '
}`,
    },
    output: { ...DEFAULT_SETTINGS.output, columns: 80, rows: 24, grid: 'both' },
    animation: {
      animationLength: 1,
      frameRate: 1,
    },
  },
  imageCode: {
    ...DEFAULT_SETTINGS,
    meta: { name: 'Image code' },
    source: {
      data: exampleImage,
      fileName: 'example-grad.png',
      code: `import { valueToChar, getImageValue } from '@/utils'
import { imageData, frames } from '@/imageData'
import { characterSet } from '@/settings'

const speed = 4; //~ number 0-20 step=1

const { sin, abs } = Math

function main(pos, context) {
  const { x, y } = pos

  let value = getImageValue(imageData, x, y)

  const mod = abs(sin(y + context.frame * speed * 0.01))
  return {
    char: valueToChar(value * mod, characterSet)
  }
}`,
    },
    output: {
      ...DEFAULT_SETTINGS.output,
      characterSet: '=-:. ',
      columns: 80,
      rows: 40,
      grid: 'none',
    },
    animation: {
      animationLength: 100,
      frameRate: 30,
    },
  },
}

export type TemplateType = keyof typeof TEMPLATES
