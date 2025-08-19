/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

export const sin = `/**
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
