/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

// The partial-settings payload the ox-dual-grid Figma plugin puts on the
// clipboard ("Copy Mitos config"). Pasting it merges only the fields it
// names into the current settings — unlike loading a project JSON, which
// replaces everything — so a canvas can be aligned with a Figma grid
// without losing its source, code or colours.
export interface GridConfig {
  mitos: 'grid-config'
  version: number
  output: {
    columns: number
    rows: number
    aspectRatio?: number
    useImageAspectRatio?: boolean
  }
  export?: {
    lineHeight?: number
    padding?: number
    width?: number
    height?: number
  }
}

export function parseGridConfig(text: string): GridConfig | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }

  const config = data as GridConfig
  if (
    !config ||
    config.mitos !== 'grid-config' ||
    typeof config.output?.columns !== 'number' ||
    typeof config.output?.rows !== 'number'
  ) {
    return null
  }

  return config
}
