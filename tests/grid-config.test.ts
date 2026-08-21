/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { describe, expect, test } from 'bun:test'

import { parseGridConfig } from '~/lib/grid-config'

// The payload ox-dual-grid's "Copy Mitos config" button produces.
const valid = {
  mitos: 'grid-config',
  version: 1,
  output: {
    columns: 96,
    rows: 25,
    aspectRatio: 1.7778,
    useImageAspectRatio: false,
  },
  export: { lineHeight: 1.341, padding: 0, width: 1920, height: 1080 },
}

describe('parseGridConfig', () => {
  test('accepts the plugin payload', () => {
    const config = parseGridConfig(JSON.stringify(valid))
    expect(config).not.toBeNull()
    expect(config?.output.columns).toBe(96)
    expect(config?.output.rows).toBe(25)
    expect(config?.export?.width).toBe(1920)
    expect(config?.export?.height).toBe(1080)
  })

  test('accepts a minimal config without export sections', () => {
    const config = parseGridConfig(
      JSON.stringify({ mitos: 'grid-config', version: 1, output: { columns: 8, rows: 4 } }),
    )
    expect(config?.output.columns).toBe(8)
    expect(config?.export).toBeUndefined()
  })

  test('rejects non-JSON text', () => {
    expect(parseGridConfig('not json')).toBeNull()
  })

  test('rejects JSON without the marker', () => {
    expect(parseGridConfig(JSON.stringify({ output: valid.output }))).toBeNull()
  })

  test('rejects a marker with missing dimensions', () => {
    expect(
      parseGridConfig(JSON.stringify({ mitos: 'grid-config', output: { columns: 96 } })),
    ).toBeNull()
  })

  test('rejects JSON primitives', () => {
    expect(parseGridConfig('null')).toBeNull()
    expect(parseGridConfig('42')).toBeNull()
    expect(parseGridConfig('"grid-config"')).toBeNull()
  })

  test('rejects a saved project file (those go through Load JSON)', () => {
    const project = { name: 'My Project', settings: { output: valid.output } }
    expect(parseGridConfig(JSON.stringify(project))).toBeNull()
  })
})
