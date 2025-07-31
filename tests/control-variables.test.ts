import { describe, expect, test } from 'bun:test'

import { PATTERNS } from '~/components/code-sidebar'

describe('Control Variable Patterns', () => {
  test('SIMPLE_VAR pattern should match basic variable declarations', () => {
    const tests = [
      ['const speed = 5; //~ number 1-10', ['speed', '5', 'number 1-10']],
      ['const enabled = true; //~ boolean', ['enabled', 'true', 'boolean']],
      ['const text = "hello"; //~ text', ['text', '"hello"', 'text']],
    ]

    tests.forEach(([line, expected]) => {
      const match = (line as string).match(PATTERNS.SIMPLE_VAR)

      expect(match).not.toBeNull()
      expect([match![1], match![2], match![3]]).toEqual(expected as string[])
    })
  })

  test('SIMPLE_VAR pattern should match TypeScript typed variable declarations', () => {
    const tests = [
      ['const speed: number = 5; //~ number 1-10', ['speed', '5', 'number 1-10']],
      ['const enabled: boolean = true; //~ boolean', ['enabled', 'true', 'boolean']],
      ['const text: string = "hello"; //~ text', ['text', '"hello"', 'text']],
      ['const count: number = 42; //~ number 0-100', ['count', '42', 'number 0-100']],
      ['const name: string = `world`; //~ text', ['name', '`world`', 'text']],
    ]

    tests.forEach(([line, expected]) => {
      const match = (line as string).match(PATTERNS.SIMPLE_VAR)

      expect(match).not.toBeNull()
      expect([match![1], match![2], match![3]]).toEqual(expected as string[])
    })
  })

  test('ROOT_OBJECT pattern should match inline object declarations', () => {
    const line = 'const config = { x: 10, y: 20 }; //~ number 0-100'
    const match = line.match(PATTERNS.ROOT_OBJECT)

    expect(match).not.toBeNull()
    expect(match![1]).toBe('config')
    expect(match![2]).toBe('x: 10, y: 20 ')
    expect(match![3]).toBe('number 0-100')
  })

  test('ROOT_OBJECT pattern should match TypeScript typed inline object declarations', () => {
    const tests = [
      [
        'const config: { x: number; y: number } = { x: 10, y: 20 }; //~ number 0-100',
        ['config', 'x: 10, y: 20 ', 'number 0-100'],
      ],
      [
        'const position: Position = { x: 5, y: 15 }; //~ number 1-50',
        ['position', 'x: 5, y: 15 ', 'number 1-50'],
      ],
      [
        'const settings: any = { width: 800, height: 600 }; //~ number 100-2000',
        ['settings', 'width: 800, height: 600 ', 'number 100-2000'],
      ],
    ]

    tests.forEach(([line, expected]) => {
      const match = (line as string).match(PATTERNS.ROOT_OBJECT)

      expect(match).not.toBeNull()
      expect([match![1], match![2], match![3]]).toEqual(expected as string[])
    })
  })

  test('OBJECT_PROP pattern should match object properties', () => {
    const line = '  width: 800, //~ number 100-2000'
    const match = line.match(PATTERNS.OBJECT_PROP)

    expect(match).not.toBeNull()
    expect(match![1]).toBe('width')
    expect(match![2]).toBe('800')
    expect(match![3]).toBe('number 100-2000')
  })

  test('RANGE pattern should extract min-max values', () => {
    const tests = [
      ['number 1-10', ['1', '10']],
      ['number -50-50', ['-50', '50']],
      ['number 0.5-10.5', ['0.5', '10.5']],
    ]

    tests.forEach(([config, expected]) => {
      const match = (config as string).match(PATTERNS.RANGE)
      expect(match).not.toBeNull()
      expect([match![1], match![2]]).toEqual(expected as string[])
    })
  })

  test('STEP pattern should extract step values', () => {
    const config = 'number 1-10 step=0.5'
    const match = config.match(PATTERNS.STEP)

    expect(match).not.toBeNull()
    expect(match![1]).toBe('0.5')
  })
})

describe('Control Variable Parsing Integration', () => {
  // Simple mock of the parseControlVariables function to test key scenarios
  function extractControlVariables(code: string) {
    const lines = code.split('\n')
    const controls: Array<{
      name: string
      type: string
      value: string | number | boolean
    }> = []

    lines.forEach((line) => {
      const simpleMatch = line.match(PATTERNS.SIMPLE_VAR)
      if (simpleMatch) {
        const [, name, valueStr, controlConfig] = simpleMatch
        const type = controlConfig.trim().split(/\s+/)[0]

        let value: string | number | boolean = valueStr.trim()
        if (type === 'number') value = parseFloat(value)
        if (type === 'boolean') value = value === 'true'
        if (type === 'text') value = (value as string).replace(/^['"`]|['"`]$/g, '')

        controls.push({ name, type, value })
      }

      const rootObjectMatch = line.match(PATTERNS.ROOT_OBJECT)
      if (rootObjectMatch) {
        const [, _objName, content, controlConfig] = rootObjectMatch
        const type = controlConfig.trim().split(/\s+/)[0]

        let match
        PATTERNS.PROP_VALUE.lastIndex = 0
        while ((match = PATTERNS.PROP_VALUE.exec(content)) !== null) {
          const [, propName, valueStr] = match
          let value: string | number | boolean = valueStr.trim()
          if (type === 'number') value = parseFloat(value)
          if (type === 'boolean') value = value === 'true'
          if (type === 'text') value = (value as string).replace(/^['"`]|['"`]$/g, '')

          controls.push({ name: propName, type, value })
        }
      }
    })

    return controls
  }

  test('should parse simple variable declarations', () => {
    const code = `
const speed = 5; //~ number 1-10
const enabled = true; //~ boolean
const message = "hello"; //~ text
    `

    const result = extractControlVariables(code)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ name: 'speed', type: 'number', value: 5 })
    expect(result[1]).toEqual({ name: 'enabled', type: 'boolean', value: true })
    expect(result[2]).toEqual({ name: 'message', type: 'text', value: 'hello' })
  })

  test('should parse TypeScript typed variable declarations', () => {
    const code = `
const speed: number = 5; //~ number 1-10
const enabled: boolean = true; //~ boolean
const message: string = "hello"; //~ text
const count: number = 42; //~ number 0-100
const active: boolean = false; //~ boolean
    `

    const result = extractControlVariables(code)

    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({ name: 'speed', type: 'number', value: 5 })
    expect(result[1]).toEqual({ name: 'enabled', type: 'boolean', value: true })
    expect(result[2]).toEqual({ name: 'message', type: 'text', value: 'hello' })
    expect(result[3]).toEqual({ name: 'count', type: 'number', value: 42 })
    expect(result[4]).toEqual({ name: 'active', type: 'boolean', value: false })
  })

  test('should parse inline object declarations', () => {
    const code = `const position = { x: 10, y: 20 }; //~ number 0-100`

    const result = extractControlVariables(code)

    expect(result.length).toBeGreaterThan(0)
    expect(result.some((r) => r.name === 'x' && r.value === 10)).toBe(true)
    expect(result.some((r) => r.name === 'y' && r.value === 20)).toBe(true)
  })

  test('should parse TypeScript typed inline object declarations', () => {
    const code = `const position: { x: number; y: number } = { x: 10, y: 20 }; //~ number 0-100`

    const result = extractControlVariables(code)

    expect(result.length).toBeGreaterThan(0)
    expect(result.some((r) => r.name === 'x' && r.value === 10)).toBe(true)
    expect(result.some((r) => r.name === 'y' && r.value === 20)).toBe(true)
  })

  test('should handle different quote types in text values', () => {
    const code = `
const single = 'hello'; //~ text
const double = "world"; //~ text
const backtick = \`test\`; //~ text
    `

    const result = extractControlVariables(code)

    expect(result).toHaveLength(3)
    expect(result[0].value).toBe('hello')
    expect(result[1].value).toBe('world')
    expect(result[2].value).toBe('test')
  })

  test('should ignore lines without control annotations', () => {
    const code = `
const regularVar = 10;
const speed = 5; //~ number 1-10
const anotherVar = "test";
    `

    const result = extractControlVariables(code)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('speed')
  })

  test('should handle mixed TypeScript typed and untyped variables', () => {
    const code = `
const speed = 5; //~ number 1-10
const position: { x: number; y: number } = { x: 10, y: 20 }; //~ number 0-100
const enabled: boolean = true; //~ boolean
const message = "hello"; //~ text
    `

    const result = extractControlVariables(code)

    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({ name: 'speed', type: 'number', value: 5 })
    expect(result.some((r) => r.name === 'x' && r.value === 10)).toBe(true)
    expect(result.some((r) => r.name === 'y' && r.value === 20)).toBe(true)
    expect(result.some((r) => r.name === 'enabled' && r.value === true)).toBe(true)
    expect(result.some((r) => r.name === 'message' && r.value === 'hello')).toBe(true)
  })

  test('should handle complex TypeScript type annotations', () => {
    const code = `
const config: Record<string, number> = { width: 800, height: 600 }; //~ number 100-2000
const settings: any = { x: 5 }; //~ number 1-10
const point: Point = { x: 15, y: 25 }; //~ number 0-50
    `

    const result = extractControlVariables(code)

    expect(result.length).toBeGreaterThan(0)
    expect(result.some((r) => r.name === 'width' && r.value === 800)).toBe(true)
    expect(result.some((r) => r.name === 'height' && r.value === 600)).toBe(true)
    expect(result.some((r) => r.name === 'x' && r.value === 5)).toBe(true)
    expect(result.some((r) => r.name === 'x' && r.value === 15)).toBe(true)
    expect(result.some((r) => r.name === 'y' && r.value === 25)).toBe(true)
  })
})
