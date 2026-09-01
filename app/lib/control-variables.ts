/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { typescriptLanguage } from '@codemirror/lang-javascript'
import type { SyntaxNode } from '@lezer/common'

export type ControlValue = string | number | boolean
export type ControlType = 'text' | 'number' | 'boolean'

export interface ControlVariable {
  /** Stable identifier: dotted path, suffixed with #n for duplicate paths */
  id: string
  name: string
  value: ControlValue
  type: ControlType
  min?: number
  max?: number
  step?: number
  /** Absolute offsets of the value expression in the document */
  from: number
  to: number
  /** Quote character of the original string literal (text controls only) */
  quote?: string
  parent?: string
  nestedParent?: string
}

const RANGE = /(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)/
const STEP = /step=(\d+(?:\.\d+)?)/
const ANNOTATION = /^\/\/~\s*(.+)/

interface ControlConfig {
  type: ControlType
  min?: number
  max?: number
  step?: number
}

function parseConfig(config: string): ControlConfig | null {
  const type = config.trim().split(/\s+/)[0]
  if (type !== 'number' && type !== 'text' && type !== 'boolean') return null

  const rangeMatch = config.match(RANGE)
  const stepMatch = config.match(STEP)
  return {
    type,
    min: rangeMatch ? parseFloat(rangeMatch[1]) : undefined,
    max: rangeMatch ? parseFloat(rangeMatch[2]) : undefined,
    step: stepMatch ? parseFloat(stepMatch[1]) : undefined,
  }
}

interface Literal {
  kind: ControlType
  value: ControlValue
  quote?: string
}

/**
 * Extract the value of a literal expression node. Returns null for anything
 * that isn't a plain literal (expressions, identifiers, calls, …) so controls
 * are only offered where an edit can't clobber meaningful code.
 */
function parseLiteral(node: SyntaxNode, code: string): Literal | null {
  const text = () => code.slice(node.from, node.to)

  switch (node.name) {
    case 'Number':
      return { kind: 'number', value: parseFloat(text()) }
    case 'BooleanLiteral':
      return { kind: 'boolean', value: text() === 'true' }
    case 'String': {
      const raw = text()
      return {
        kind: 'text',
        value: raw.slice(1, -1).replace(/\\(.)/g, '$1'),
        quote: raw[0],
      }
    }
    case 'TemplateString': {
      // Only treat templates without interpolations as editable text
      if (node.getChild('Interpolation')) return null
      return { kind: 'text', value: text().slice(1, -1), quote: '`' }
    }
    case 'UnaryExpression': {
      const op = node.getChild('ArithOp')
      const num = node.getChild('Number')
      if (!op || !num || code.slice(op.from, op.to) !== '-') return null
      return { kind: 'number', value: -parseFloat(code.slice(num.from, num.to)) }
    }
    default:
      return null
  }
}

function isComment(node: SyntaxNode) {
  return node.name === 'LineComment' || node.name === 'BlockComment'
}

/**
 * Parse `//~` control annotations out of a script using the Lezer syntax tree
 * (the same grammar CodeMirror uses to highlight the editor). Positions come
 * from AST nodes, so they are exact regardless of strings, comments, nesting,
 * or lookalike text elsewhere on the line.
 *
 * An annotation applies to the declaration or object property whose value
 * ends on the annotation's line. Annotating an object applies the config to
 * every literal property inside it (recursively), e.g.
 * `const pos = { x: 1, y: -2 } //~ number 0-10`.
 */
export function parseControlVariables(code: string): ControlVariable[] {
  const tree = typescriptLanguage.parser.parse(code)

  const lineStarts = [0]
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') lineStarts.push(i + 1)
  }
  const lineAt = (pos: number) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  // First pass: collect //~ annotations by line
  const annotations = new Map<number, { config: string; from: number }>()
  tree.iterate({
    enter(ref) {
      if (ref.name !== 'LineComment') return
      const match = code.slice(ref.from, ref.to).match(ANNOTATION)
      if (match) {
        annotations.set(lineAt(ref.from), { config: match[1].trim(), from: ref.from })
      }
    },
  })
  if (annotations.size === 0) return []

  /** Annotation on the line where `node` ends, if the comment comes after it */
  const annotationFor = (node: SyntaxNode): string | undefined => {
    const annotation = annotations.get(lineAt(node.to))
    return annotation && annotation.from >= node.to ? annotation.config : undefined
  }

  const controls: ControlVariable[] = []
  const pathCounts = new Map<string, number>()

  const addControl = (
    path: string[],
    node: SyntaxNode,
    literal: Literal,
    config: string,
  ) => {
    const parsed = parseConfig(config)
    // Only offer a control when the annotated type matches the actual literal
    if (!parsed || parsed.type !== literal.kind) return

    const dotted = path.join('.')
    const count = pathCounts.get(dotted) ?? 0
    pathCounts.set(dotted, count + 1)

    controls.push({
      id: count === 0 ? dotted : `${dotted}#${count}`,
      name: path[path.length - 1],
      value: literal.value,
      type: parsed.type,
      min: parsed.min,
      max: parsed.max,
      step: parsed.step,
      from: node.from,
      to: node.to,
      quote: literal.quote,
      parent: path.length > 1 ? path[0] : undefined,
      nestedParent: path.length > 2 ? path.slice(1, -1).join('.') : undefined,
    })
  }

  const processValue = (path: string[], node: SyntaxNode, inherited?: string) => {
    const literal = parseLiteral(node, code)
    if (literal) {
      const config = annotationFor(node) ?? inherited
      if (config) addControl(path, node, literal, config)
      return
    }

    if (node.name === 'ObjectExpression') {
      const group = annotationFor(node) ?? inherited
      for (let prop = node.firstChild; prop; prop = prop.nextSibling) {
        if (prop.name !== 'Property') continue
        const def = prop.getChild('PropertyDefinition')
        let value = prop.lastChild
        while (value && isComment(value)) value = value.prevSibling
        if (!def || !value || value.from <= def.from) continue
        processValue([...path, code.slice(def.from, def.to)], value, group)
      }
    }
  }

  // Second pass: walk declarations (const/let/var, anywhere in the script)
  tree.iterate({
    enter(ref) {
      if (ref.name !== 'VariableDeclaration') return
      const node = ref.node
      let name: string | null = null
      let sawEquals = false
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.name === 'VariableDefinition') {
          name = code.slice(child.from, child.to)
          sawEquals = false
        } else if (child.name === 'Equals') {
          sawEquals = true
        } else if (sawEquals && name && !isComment(child)) {
          processValue([name], child)
          name = null
          sawEquals = false
        }
      }
    },
  })

  return controls
}

/** Serialize a new control value so it can replace `[control.from, control.to)` */
export function formatControlValue(control: ControlVariable, value: ControlValue): string {
  if (control.type === 'boolean') return String(value)

  if (control.type === 'number') {
    let rounded = value as number
    if (control.step && control.step < 1) {
      const decimalPlaces = Math.abs(Math.floor(Math.log10(control.step)))
      rounded =
        Math.round(rounded * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
    }
    return String(rounded)
  }

  const quote = control.quote === '"' || control.quote === '`' ? control.quote : "'"
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .split(quote)
    .join(`\\${quote}`)
    .replace(/\n/g, '\\n')
  return quote + escaped + quote
}
