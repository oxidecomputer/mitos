/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { redo, undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { DirectionDownIcon, Info12Icon } from '@oxide/design-system/icons/react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { InputButton, InputNumber, InputSwitch } from '~/lib/ui/src'
import { LinkButton } from '~/lib/ui/src/components/InputButton/InputButton'
import { InputText } from '~/lib/ui/src/components/InputText/InputText'
import { cn } from '~/lib/utils'

import type { SourceType } from './ascii-art-generator'
import CodeEditor from './code-editor'

interface CodeSidebarProps {
  pendingCode: string
  setPendingCode: (code: string) => void
  isOpen: boolean
  updateSettings: (
    settings: Partial<{
      type: SourceType
      data: string | null
      code: string
    }>,
  ) => void
}

interface ControlVariable {
  name: string
  value: string | number | boolean
  type: 'text' | 'number' | 'boolean'
  min?: number
  max?: number
  step?: number
  line: number
  startPos: number
  endPos: number
  objectPath?: string
  parent?: string
  nestedParent?: string
}

// Regex patterns used throughout parsing
const PATTERNS = {
  ROOT_OBJECT: /const\s+(\w+)\s*=\s*\{\s*([^}]*)\s*\}\s*;?\s*\/\/~\s*(.+)/,
  MULTI_OBJECT: /const\s+(\w+)\s*=\s*\{/,
  SIMPLE_VAR: /const\s+(\w+)\s*=\s*(.+?);?\s*\/\/~\s*(.+)/,
  NESTED_OBJECT: /\s*(\w+):\s*\{\s*([^}]+)\s*\},?\s*\/\/~\s*(.+)/,
  OBJECT_PROP: /\s*(\w+):\s*(.+?),?\s*\/\/~\s*(.+)/,
  PROP_VALUE: /(\w+):\s*([^,}]+)/g,
  RANGE: /(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)/,
  STEP: /step=(\d+(?:\.\d+)?)/,
} as const

function parseControlConfig(
  name: string,
  valueStr: string,
  controlConfig: string,
  lineIndex: number,
  line: string,
  startPos?: number,
  endPos?: number,
  parent?: string,
  propName?: string,
  nestedParent?: string,
): ControlVariable | null {
  const parts = controlConfig.trim().split(/\s+/)
  if (parts.length === 0) return null

  const type = parts[0] as ControlVariable['type']
  let value: string | number | boolean
  let min: number | undefined
  let max: number | undefined
  let step: number | undefined

  // Parse value based on type
  switch (type) {
    case 'boolean': {
      value = valueStr.trim() === 'true'
      break
    }
    case 'number': {
      value = parseFloat(valueStr.trim())

      const rangeMatch = controlConfig.match(PATTERNS.RANGE)
      if (rangeMatch) {
        min = parseFloat(rangeMatch[1])
        max = parseFloat(rangeMatch[2])
      }

      const stepMatch = controlConfig.match(PATTERNS.STEP)
      if (stepMatch) {
        step = parseFloat(stepMatch[1])
      }
      break
    }
    case 'text': {
      value = valueStr.trim().replace(/^['"`]|['"`]$/g, '')
      break
    }
    default:
      return null
  }

  // Calculate positions if not provided
  let finalStartPos = startPos
  let finalEndPos = endPos
  if (finalStartPos === undefined || finalEndPos === undefined) {
    const trimmedValue = valueStr.trim()
    finalStartPos = line.indexOf(trimmedValue)
    finalEndPos = finalStartPos + trimmedValue.length
  }

  return {
    name: propName || name,
    value,
    type,
    step,
    min,
    max,
    line: lineIndex,
    startPos: finalStartPos,
    endPos: finalEndPos,
    objectPath: parent ? name : undefined,
    parent,
    nestedParent,
  }
}

function parseNestedObjectProperties(
  objectContent: string,
  controlConfig: string,
  parentObject: string | undefined,
  nestedPropName: string,
  lineIndex: number,
  line: string,
): ControlVariable[] {
  const controls: ControlVariable[] = []
  const propMatches = objectContent.match(PATTERNS.PROP_VALUE)

  if (!propMatches) return controls

  propMatches.forEach((propMatch) => {
    const match = propMatch.match(/(\w+):\s*(.+)/)
    if (!match) return

    const [, propName] = match
    const fullName = parentObject
      ? `${parentObject}.${nestedPropName}.${propName}`
      : `${nestedPropName}.${propName}`

    // Find exact position in line
    const propPattern = new RegExp(`\\b${propName}\\s*:\\s*([^,}]+)`)
    const propSearchMatch = line.match(propPattern)

    if (propSearchMatch) {
      const actualValue = propSearchMatch[1].trim()
      const propStartInLine = line.indexOf(propSearchMatch[0])
      const valueStartInMatch = propSearchMatch[0].indexOf(actualValue)
      const valueStart = propStartInLine + valueStartInMatch
      const valueEnd = valueStart + actualValue.length

      const control = parseControlConfig(
        propName,
        actualValue,
        controlConfig,
        lineIndex,
        line,
        valueStart,
        valueEnd,
        parentObject,
        propName,
        parentObject ? nestedPropName : undefined,
      )

      if (control) {
        control.objectPath = fullName
        if (!parentObject) {
          control.parent = nestedPropName
        }
        controls.push(control)
      }
    }
  })

  return controls
}

function parseControlVariables(code: string): ControlVariable[] {
  const lines = code.split('\n')
  const controls: ControlVariable[] = []
  let currentObject: string | null = null
  let braceDepth = 0

  lines.forEach((line, lineIndex) => {
    // Handle root-level object with control annotation
    const rootObjectMatch = line.match(PATTERNS.ROOT_OBJECT)
    if (rootObjectMatch) {
      const [, name, objectContent, controlConfig] = rootObjectMatch
      const nestedControls = parseNestedObjectProperties(
        objectContent,
        controlConfig,
        undefined,
        name,
        lineIndex,
        line,
      )
      controls.push(...nestedControls)
      return
    }

    // Track multi-line objects
    const objectMatch = line.match(PATTERNS.MULTI_OBJECT)
    if (objectMatch) {
      currentObject = objectMatch[1]
      braceDepth = 1
      return
    }

    // Track brace depth when inside an object
    if (currentObject) {
      const openBraces = (line.match(/\{/g) || []).length
      const closeBraces = (line.match(/\}/g) || []).length
      braceDepth += openBraces - closeBraces

      if (braceDepth <= 0) {
        currentObject = null
        braceDepth = 0
        return
      }
    }

    // Handle simple variable declarations
    const simpleMatch = line.match(PATTERNS.SIMPLE_VAR)
    if (simpleMatch) {
      const [, name, valueStr, controlConfig] = simpleMatch
      const control = parseControlConfig(name, valueStr, controlConfig, lineIndex, line)
      if (control) controls.push(control)
      return
    }

    // Handle nested objects and properties within current object
    if (currentObject) {
      const nestedObjectMatch = line.match(PATTERNS.NESTED_OBJECT)
      if (nestedObjectMatch) {
        const [, propName, objectContent, controlConfig] = nestedObjectMatch
        const nestedControls = parseNestedObjectProperties(
          objectContent,
          controlConfig,
          currentObject,
          propName,
          lineIndex,
          line,
        )
        controls.push(...nestedControls)
        return
      }

      const propMatch = line.match(PATTERNS.OBJECT_PROP)
      if (propMatch) {
        const [, propName, valueStr, controlConfig] = propMatch
        const control = parseControlConfig(
          propName,
          valueStr,
          controlConfig,
          lineIndex,
          line,
          undefined,
          undefined,
          currentObject,
          propName,
        )
        if (control) {
          control.objectPath = `${currentObject}.${propName}`
          controls.push(control)
        }
      }
    }
  })

  return controls
}

export function CodeSidebar({
  isOpen,
  pendingCode,
  setPendingCode,
  updateSettings,
}: CodeSidebarProps) {
  const [width, setWidth] = useState(400)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [isResizing, setIsResizing] = useState(false)
  const editorViewRef = useRef<EditorView | null>(null)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [autoRun, setAutoRun] = useState(true)
  const updateTimeoutRef = useRef<number>(null)

  const handleUndo = () => editorViewRef.current && undo(editorViewRef.current)
  const handleRedo = () => editorViewRef.current && redo(editorViewRef.current)
  const handleCodeRun = () =>
    updateSettings({ data: null, code: pendingCode, type: 'code' })
  const handleCodeChange = (value: string) => setPendingCode(value)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const newWidth = window.innerWidth - e.clientX
    setWidth(Math.min(Math.max(newWidth, 300), 800))
  }, [])

  const stopResize = useCallback(() => {
    isDragging.current = false
    setIsResizing(false)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
  }, [handleMouseMove])

  const controlVariables = useMemo(() => parseControlVariables(pendingCode), [pendingCode])

  // Group controls by parent object with nested structure
  const groupedControls = useMemo(() => {
    const groups: {
      [key: string]: {
        controls: ControlVariable[]
        nested: { [key: string]: ControlVariable[] }
      }
    } = { root: { controls: [], nested: {} } }

    controlVariables.forEach((control) => {
      if (control.nestedParent && control.parent) {
        // Nested control
        if (!groups[control.parent]) {
          groups[control.parent] = { controls: [], nested: {} }
        }
        if (!groups[control.parent].nested[control.nestedParent]) {
          groups[control.parent].nested[control.nestedParent] = []
        }
        groups[control.parent].nested[control.nestedParent].push(control)
      } else if (control.parent) {
        // Parent object control
        if (!groups[control.parent]) {
          groups[control.parent] = { controls: [], nested: {} }
        }
        groups[control.parent].controls.push(control)
      } else {
        // Root level control
        groups.root.controls.push(control)
      }
    })

    return groups
  }, [controlVariables])

  const updateControlVariable = (
    controlName: string,
    newValue: string | number | boolean,
  ) => {
    if (!editorViewRef.current) return

    const currentContent = editorViewRef.current.state.doc.toString()
    const currentControls = parseControlVariables(currentContent)
    const control = currentControls.find((c) => (c.objectPath || c.name) === controlName)

    if (!control) return

    const lines = currentContent.split('\n')

    // Format value based on type
    let formattedValue: string
    if (control.type === 'boolean') {
      formattedValue = String(newValue)
    } else if (control.type === 'number') {
      let roundedValue = newValue as number
      if (control.step && control.step < 1) {
        const decimalPlaces = Math.abs(Math.floor(Math.log10(control.step)))
        roundedValue =
          Math.round((newValue as number) * Math.pow(10, decimalPlaces)) /
          Math.pow(10, decimalPlaces)
      }
      formattedValue = String(roundedValue)
    } else {
      formattedValue = `'${newValue}'`
    }

    // Calculate document positions
    const lineStart = lines
      .slice(0, control.line)
      .reduce((acc, line) => acc + line.length + 1, 0)
    const changeStart = lineStart + control.startPos
    const changeEnd = lineStart + control.endPos

    // Clear pending timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
      updateTimeoutRef.current = null
    }

    // Apply change
    const transaction = editorViewRef.current.state.update({
      changes: { from: changeStart, to: changeEnd, insert: formattedValue },
    })
    editorViewRef.current.dispatch(transaction)

    const newContent = transaction.state.doc.toString()
    setPendingCode(newContent)

    // Debounced auto-run
    if (autoRun) {
      updateTimeoutRef.current = window.setTimeout(() => {
        updateSettings({ data: null, code: newContent, type: 'code' })
        updateTimeoutRef.current = null
      }, 100)
    }
  }

  const renderControl = (control: ControlVariable) => {
    const controlKey = control.objectPath || control.name

    const controlProps = {
      onChange: (val: string | number | boolean) => updateControlVariable(controlKey, val),
      children: control.name,
    }

    switch (control.type) {
      case 'text':
        return (
          <InputText key={controlKey} {...controlProps} value={control.value as string} />
        )
      case 'number':
        return (
          <InputNumber
            key={controlKey}
            {...controlProps}
            value={control.value as number}
            min={control.min}
            max={control.max}
            step={control.step || 0.01}
          />
        )
      case 'boolean':
        return (
          <InputSwitch
            key={controlKey}
            {...controlProps}
            checked={control.value as boolean}
            onChange={(checked) => updateControlVariable(controlKey, checked)}
          />
        )
      default:
        return null
    }
  }

  const renderControlGroup = (
    groupName: string,
    group: { controls: ControlVariable[]; nested: { [key: string]: ControlVariable[] } },
  ) => {
    if (group.controls.length === 0 && Object.keys(group.nested).length === 0) return null

    return (
      <div key={groupName} className="space-y-2">
        {groupName !== 'root' && (
          <div className="font-mono text-[11px] uppercase text-tertiary">{groupName}</div>
        )}
        <div className={groupName !== 'root' ? 'dedent' : ''}>
          <div className="space-y-2">
            {group.controls.map(renderControl)}
            {Object.entries(group.nested).map(([nestedName, nestedControls]) => (
              <div key={nestedName} className="space-y-2">
                <div className="font-mono text-[11px] uppercase text-tertiary">
                  {nestedName}
                </div>
                <div className="dedent">
                  <div className="flex flex-wrap gap-4">
                    {nestedControls.map(renderControl)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    setIsResizing(true)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
  }

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stopResize)
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [handleMouseMove, stopResize])

  useHotkeys(
    'shift+r',
    handleCodeRun,
    {
      enableOnFormTags: true,
      preventDefault: true,
      enableOnContentEditable: true,
    },
    [pendingCode],
  )

  return (
    <motion.div
      ref={sidebarRef}
      initial={false}
      animate={{ width: isOpen ? width : 0 }}
      transition={
        isResizing ? { duration: 0 } : { type: 'spring', duration: 0.5, bounce: 0 }
      }
      className="bg-background relative overflow-hidden border-l border-default"
      style={{ minWidth: 0 }}
    >
      <motion.div
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={{ duration: isOpen ? 0.3 : 0.1 }}
        style={{
          width: `${width}px`,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        className="h-full"
      >
        <div
          className="absolute -left-2 top-0 z-10 h-full w-4 cursor-ew-resize"
          onMouseDown={startResize}
        />

        <div className="flex h-full flex-col">
          <div className="flex gap-2 border-b px-4 py-3 border-default">
            <InputButton onClick={handleCodeRun}>Run</InputButton>
            <InputButton variant="secondary" onClick={handleUndo}>
              Undo
            </InputButton>
            <InputButton variant="secondary" onClick={handleRedo}>
              Redo
            </InputButton>
            <LinkButton
              to="https://play.ertdfgcvb.xyz/abc.html"
              inline
              icon
              variant="secondary"
            >
              <Info12Icon className="text-secondary" />
            </LinkButton>
          </div>

          <div className="flex-1 overflow-auto">
            <CodeEditor
              value={pendingCode}
              onChange={handleCodeChange}
              editorViewRef={editorViewRef}
            />
          </div>

          {controlVariables.length > 0 && (
            <div className="border-t border-default">
              <button
                onClick={() => setControlsOpen(!controlsOpen)}
                className="flex w-full items-center justify-between space-y-3 px-4 py-1 font-mono text-[11px] uppercase text-secondary hover:bg-hover"
              >
                Controls
                <DirectionDownIcon
                  className={cn(
                    'transition-transform text-quaternary',
                    controlsOpen ? '' : 'rotate-180',
                  )}
                />
              </button>
              {controlsOpen && (
                <>
                  <div className="max-h-[50vh] space-y-3 overflow-auto border-t px-4 py-3 border-default">
                    {Object.entries(groupedControls).map(([groupName, group]) =>
                      renderControlGroup(groupName, group),
                    )}
                  </div>
                  <div className="border-t px-4 py-2 border-default">
                    <InputSwitch checked={autoRun} onChange={setAutoRun}>
                      Auto Run
                    </InputSwitch>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
