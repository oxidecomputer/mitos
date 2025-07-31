/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

export const unpkgDemo = `import { createNoise2D } from 'simplex-noise'

const speed = 2; //~ number 0-100 step=1
const scaleX = 3.45; //~ number 1-50
const scaleY = 2; //~ number 1-50

let noise2D
const characters = '  .:-='

function boot() {
  noise2D = createNoise2D()
}

function main(coord, context, cursor, buffer) {
  const { x, y } = coord
  const { cols, rows } = context

  // Normalize coordinates
  const nx = x / cols
  const ny = y / rows

  const time = context.frame * speed * 0.001

  const noise = noise2D(nx * scaleX + time, ny * scaleY + time * 0.5) * 0.5

  // Map to character index
  const normalized = (noise + 1) * 0.5 // Convert from [-1,1] to [0,1]
  const charIndex = Math.floor(normalized * characters.length)
  const clampedIndex = Math.max(0, Math.min(charIndex, characters.length - 1))

  return characters[clampedIndex]
}`
