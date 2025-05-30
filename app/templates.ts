/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { AsciiSettings } from './components/ascii-art-generator'
import { predefinedCharacterSets } from './components/output-options'
import { clock } from './scripts/clock'
import { numbers } from './scripts/numbers'

export const DEFAULT_CODE = `/**
@author ertdfgcvb
@url https://play.ertdfgcvb.xyz/#/src/basics/time_milliseconds
*/

const pattern = 'ABCxyz01═|+:. '; //~ text
const speed = 1; //~ number 0-10 step=0.5
const amplitude = 18; //~ number 1-50

// Renders each cell
function main(coord, context, cursor, buffer) {
  const t = context.time * 0.0001 * speed
  const x = coord.x
  const y = coord.y
  const o = Math.sin(y * Math.sin(t) * 0.2 + x * 0.04 + t) * amplitude
  const i = Math.round(Math.abs(x + y + o)) % pattern.length
  return pattern[i]
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
    type: 'image',
    data: null,
    code: DEFAULT_CODE,
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
    padding: 12,
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
    source: { type: 'code', data: null, code: clock },
    output: { ...DEFAULT_SETTINGS, columns: 61, rows: 9, grid: 'both' },
    animation: {
      animationLength: 900,
      frameRate: 15,
    },
  },
  numbers: {
    ...DEFAULT_SETTINGS,
    meta: { name: 'Numbers' },
    source: { type: 'code', data: null, code: numbers },
    output: { ...DEFAULT_SETTINGS, columns: 98, rows: 9, grid: 'both' },
    animation: {
      animationLength: 1,
      frameRate: 1,
    },
  },
}

export type TemplateType = keyof typeof TEMPLATES
