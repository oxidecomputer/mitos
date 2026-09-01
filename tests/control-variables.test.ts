/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { describe, expect, test } from 'bun:test'

import {
  formatControlValue,
  parseControlVariables,
  type ControlValue,
} from '~/lib/control-variables'

/** Apply a control update the same way the sidebar does */
function applyUpdate(code: string, controlId: string, newValue: ControlValue): string {
  const control = parseControlVariables(code).find((c) => c.id === controlId)
  if (!control) throw new Error(`control not found: ${controlId}`)
  return (
    code.slice(0, control.from) +
    formatControlValue(control, newValue) +
    code.slice(control.to)
  )
}

describe('parseControlVariables', () => {
  test('parses simple variable declarations', () => {
    const code = [
      'const speed = 5; //~ number 1-10',
      'const enabled = true; //~ boolean',
      'const message = "hello"; //~ text',
    ].join('\n')

    const result = parseControlVariables(code)

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      id: 'speed',
      name: 'speed',
      type: 'number',
      value: 5,
      min: 1,
      max: 10,
    })
    expect(result[1]).toMatchObject({ id: 'enabled', type: 'boolean', value: true })
    expect(result[2]).toMatchObject({ id: 'message', type: 'text', value: 'hello' })
  })

  test('parses let and var declarations', () => {
    const code = ['let speed = 5; //~ number 1-10', 'var flag = false; //~ boolean'].join(
      '\n',
    )

    const result = parseControlVariables(code)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('speed')
    expect(result[1]).toMatchObject({ name: 'flag', value: false })
  })

  test('parses TypeScript typed declarations', () => {
    const code = [
      'const speed: number = 5; //~ number 1-10',
      'const enabled: boolean = true; //~ boolean',
      'const name: string = `world`; //~ text',
    ].join('\n')

    const result = parseControlVariables(code)

    expect(result).toHaveLength(3)
    expect(result[0].value).toBe(5)
    expect(result[1].value).toBe(true)
    expect(result[2].value).toBe('world')
  })

  test('parses range and step from the config', () => {
    const [control] = parseControlVariables('const s = 0.4; //~ number 0-10 step=0.25')
    expect(control).toMatchObject({ min: 0, max: 10, step: 0.25 })
  })

  test('parses negative ranges', () => {
    const [control] = parseControlVariables('const s = 0; //~ number -50-50')
    expect(control).toMatchObject({ min: -50, max: 50 })
  })

  test('parses negative number values', () => {
    const code = 'const z = -2; //~ number'
    const [control] = parseControlVariables(code)
    expect(control.value).toBe(-2)
    expect(code.slice(control.from, control.to)).toBe('-2')
  })

  test('annotated inline object applies config to every property', () => {
    const code = 'const position = { x: 10, y: 20 }; //~ number 0-100'

    const result = parseControlVariables(code)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: 'position.x',
      name: 'x',
      value: 10,
      parent: 'position',
      min: 0,
      max: 100,
    })
    expect(result[1]).toMatchObject({ id: 'position.y', value: 20 })
  })

  test('parses properties of multi-line objects (coins-style)', () => {
    const code = [
      'const coin1 = {',
      '  position: { x: 0.7, y: 0.5, z: -2 }, //~ number',
      '  radius: 0.8, //~ number 0-5 step=0.1',
      '};',
    ].join('\n')

    const result = parseControlVariables(code)

    expect(result.map((c) => c.id)).toEqual([
      'coin1.position.x',
      'coin1.position.y',
      'coin1.position.z',
      'coin1.radius',
    ])
    expect(result[2]).toMatchObject({
      value: -2,
      parent: 'coin1',
      nestedParent: 'position',
    })
    expect(result[3]).toMatchObject({ value: 0.8, min: 0, max: 5, step: 0.1 })
  })

  test('identical property names in different objects stay distinct', () => {
    const code = [
      'const coin1 = {',
      '  radius: 0.8, //~ number 0-5',
      '};',
      'const coin2 = {',
      '  radius: 2, //~ number 0-5',
      '};',
    ].join('\n')

    const result = parseControlVariables(code)

    expect(result.map((c) => c.id)).toEqual(['coin1.radius', 'coin2.radius'])
    expect(applyUpdate(code, 'coin2.radius', 3)).toContain('radius: 3')
    expect(applyUpdate(code, 'coin2.radius', 3)).toContain('radius: 0.8')
  })

  test('duplicate declarations get distinct ids', () => {
    const code = ['const speed = 1; //~ number', 'const speed = 2; //~ number'].join('\n')

    const result = parseControlVariables(code)

    expect(result.map((c) => c.id)).toEqual(['speed', 'speed#1'])
    expect(applyUpdate(code, 'speed#1', 9)).toBe(
      ['const speed = 1; //~ number', 'const speed = 9; //~ number'].join('\n'),
    )
  })

  test('positions point at the value even when it appears earlier in the line', () => {
    // The old indexOf-based parser found the "10" inside "scale10"
    const code = 'const scale10 = 10; //~ number 0-100'
    const [control] = parseControlVariables(code)

    expect(code.slice(control.from, control.to)).toBe('10')
    expect(applyUpdate(code, 'scale10', 42)).toBe('const scale10 = 42; //~ number 0-100')
  })

  test('ignores //~ inside string literals', () => {
    const code = "const s = 'not //~ number an annotation';"
    expect(parseControlVariables(code)).toHaveLength(0)
  })

  test('braces and commas inside strings do not break parsing', () => {
    const code = [
      'const config = {',
      "  label: 'a, b } c', //~ text",
      '  size: 4, //~ number 0-10',
      '};',
    ].join('\n')

    const result = parseControlVariables(code)

    expect(result.map((c) => c.id)).toEqual(['config.label', 'config.size'])
    expect(result[0].value).toBe('a, b } c')
  })

  test('skips non-literal values instead of offering a bogus control', () => {
    const code = ['const x = 10 * 2; //~ number', 'const y = foo(); //~ number'].join('\n')
    expect(parseControlVariables(code)).toHaveLength(0)
  })

  test('skips controls whose annotated type does not match the literal', () => {
    const code = "const s = 'hello'; //~ number 0-10"
    expect(parseControlVariables(code)).toHaveLength(0)
  })

  test('handles different quote types and preserves them on update', () => {
    const code = [
      "const single = 'hello'; //~ text",
      'const double = "world"; //~ text',
      'const backtick = `test`; //~ text',
    ].join('\n')

    const result = parseControlVariables(code)
    expect(result.map((c) => c.value)).toEqual(['hello', 'world', 'test'])

    const updated = applyUpdate(code, 'double', 'moon')
    expect(updated).toContain('const double = "moon";')
  })

  test('escapes quotes when writing text values', () => {
    const code = "const s = 'hi'; //~ text"
    expect(applyUpdate(code, 's', "it's")).toBe("const s = 'it\\'s'; //~ text")
  })

  test('ignores lines without control annotations', () => {
    const code = [
      'const regularVar = 10;',
      'const speed = 5; //~ number 1-10',
      'const anotherVar = "test";',
    ].join('\n')

    const result = parseControlVariables(code)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('speed')
  })

  test('finds declarations inside functions', () => {
    const code = ['function main() {', '  const speed = 5; //~ number 1-10', '}'].join('\n')
    expect(parseControlVariables(code)).toHaveLength(1)
  })

  test('parse is resilient to incomplete code while typing', () => {
    const code = ['const speed = 5; //~ number 1-10', 'const broken = {'].join('\n')
    const result = parseControlVariables(code)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('speed')
  })

  test('rounds number updates to the step precision', () => {
    const code = 'const s = 0.4; //~ number 0-10 step=0.25'
    expect(applyUpdate(code, 's', 0.30000000000004)).toBe(
      'const s = 0.3; //~ number 0-10 step=0.25',
    )
  })

  test('round-trips: updated code re-parses to the new value', () => {
    const code = [
      'const speed = 0.4; //~ number 0-10 step=0.25',
      'const coin1 = {',
      '  position: { x: 0.7, y: 0.5, z: -2 }, //~ number',
      '};',
    ].join('\n')

    const updated = applyUpdate(code, 'coin1.position.z', -3.5)
    const result = parseControlVariables(updated)

    expect(result.find((c) => c.id === 'coin1.position.z')?.value).toBe(-3.5)
    expect(result.find((c) => c.id === 'speed')?.value).toBe(0.4)
  })
})
