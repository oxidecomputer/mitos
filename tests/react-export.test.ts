/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { describe, expect, test } from 'bun:test'

import { generateReactComponentSource } from '~/lib/react-export'

describe('generateReactComponentSource', () => {
  test('static mode emits pre, ASCII_ART, and export colors', () => {
    const src = generateReactComponentSource({
      mode: 'static',
      componentName: 'MyAscii',
      text: 'ab\ncd',
      fps: 24,
      settings: {
        textColor: '#ff00ff',
        backgroundColor: '#111111',
        padding: 2,
      },
    })

    expect(src).toContain('export function MyAscii(')
    expect(src).toContain('const ASCII_ART = ')
    expect(src).toContain('"ab\\ncd"')
    expect(src).toContain('<pre className={className}')
    expect(src).toContain('#ff00ff')
    expect(src).toContain('#111111')
    expect(src).not.toContain('useEffect')
  })

  test('invalid component name falls back to AsciiArtEmbed', () => {
    const src = generateReactComponentSource({
      mode: 'static',
      componentName: '123Bad',
      text: 'x',
      fps: 24,
      settings: {
        textColor: '#fff',
        backgroundColor: '#000',
        padding: 0,
      },
    })

    expect(src).toContain('export function AsciiArtEmbed(')
  })

  test('animated mode embeds FRAMES and useEffect interval', () => {
    const src = generateReactComponentSource({
      mode: 'animated',
      text: '',
      frames: ['f0', 'f1'],
      fps: 24,
      settings: {
        textColor: '#fff',
        backgroundColor: '#000',
        padding: 1,
      },
    })

    expect(src).toContain('import { useEffect, useState } from')
    expect(src).toContain('const FRAMES = ')
    expect(src).toContain('FRAME_INTERVAL_MS')
    expect(src).toContain('useEffect(() => {')
    expect(src).toContain('FRAMES[frameIndex]')
    expect(src).toContain('as const')
  })

  test('animated mode clamps FPS for interval calculation', () => {
    const low = generateReactComponentSource({
      mode: 'animated',
      text: '',
      frames: ['a'],
      fps: 4,
      settings: {
        textColor: '#fff',
        backgroundColor: '#000',
        padding: 0,
      },
    })
    expect(low).toContain('FRAME_INTERVAL_MS = 100')

    const high = generateReactComponentSource({
      mode: 'animated',
      text: '',
      frames: ['a'],
      fps: 60,
      settings: {
        textColor: '#fff',
        backgroundColor: '#000',
        padding: 0,
      },
    })
    expect(high).toContain('FRAME_INTERVAL_MS = 33')
  })

  test('animated mode throws when frames empty', () => {
    expect(() =>
      generateReactComponentSource({
        mode: 'animated',
        text: '',
        frames: [],
        fps: 24,
        settings: {
          textColor: '#fff',
          backgroundColor: '#000',
          padding: 0,
        },
      }),
    ).toThrow(/at least one frame/)
  })
})
