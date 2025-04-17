/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { AsciiSettings } from './components/ascii-art-generator'
import { predefinedCharacterSets } from './components/output-configuration'

export const DEFAULT_CODE = `/**
@author ertdfgcvb
@url https://play.ertdfgcvb.xyz/#/src/basics/coordinates_xy
*/

const density = 'Ñ@#W$9876543210?!abc;:+=-,._ ';

// Renders each cell
function main(coord, context, cursor, buffer) {
  // To generate output, return a single character
  // or an object with a "char" field, for example {char: 'x'}
  const {cols, frame} = context;
  const {x, y} = coord;

  // Calculate an index into the density string
  const sign = y % 2 * 2 - 1;
  const index = (cols + y + x * sign + frame) % density.length;

  return density[index];
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
    colorMapping: 'brightness',
  },
  animation: {
    animationLength: 100,
    frameRate: 30,
  },
}

export const TEMPLATES = {
  default: DEFAULT_SETTINGS,
  custom: { ...DEFAULT_SETTINGS, meta: { name: 'Custom Project' } },
}

export type TemplateType = keyof typeof TEMPLATES
