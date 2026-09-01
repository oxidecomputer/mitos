/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { redo, undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import {
  AddRoundel12Icon,
  DirectionDownIcon,
  Info12Icon,
} from '@oxide/design-system/icons/react'
import * as Accordion from '@radix-ui/react-accordion'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useHotkeys } from 'react-hotkeys-hook'

import {
  formatControlValue,
  parseControlVariables,
  type ControlValue,
  type ControlVariable,
} from '~/lib/control-variables'
import { InputButton, InputNumber, InputSwitch } from '~/lib/ui/src'
import { LinkButton } from '~/lib/ui/src/components/InputButton/InputButton'
import { InputText } from '~/lib/ui/src/components/InputText/InputText'
import { cn } from '~/lib/utils'

import CodeEditor from './code-editor'

interface CodeSidebarProps {
  pendingCode: string
  setPendingCode: (code: string) => void
  isOpen: boolean
  updateSettings: (
    settings: Partial<{
      data: string | null
      code: string
    }>,
  ) => void
}

const UTILS = [
  {
    name: 'checkerboard',
    description: 'Generates a checkerboard pattern value for given coordinates',
    type: '(x: number, y: number, size?: number) => number',
    example: 'const value = checkerboard(coord.x, coord.y, 8)',
    importStatement: "import { checkerboard } from '@/utils'",
  },
  {
    name: 'stripes',
    description: 'Creates striped patterns in horizontal, vertical, or diagonal directions',
    type: '(x: number, y: number, stripeWidth?: number, direction?: "horizontal" | "vertical" | "diagonal") => number',
    example: 'const value = stripes(coord.x, coord.y, 4, "diagonal")',
    importStatement: "import { stripes } from '@/utils'",
  },
  {
    name: 'value-to-char',
    description: 'Converts a 0-1 value to an ASCII character for rendering',
    type: '(value: number, chars?: string) => string',
    example: `import { valueToChar, getImageValue } from '@/utils'
import { imageData } from '@/imageData'
import { characterSet } from '@/settings'

function main(pos, context) {
  const value = getImageValue(imageData, pos.x, pos.y)
  return { char: valueToChar(value, characterSet) }
}`,
    importStatement:
      "import { valueToChar } from '@/utils'\nimport { characterSet } from '@/settings'",
  },
  {
    name: 'get-image-value',
    description: 'Gets a value from 2D image data array with bounds checking',
    type: '(data: number[][], x: number, y: number) => number',
    example: `import { getImageValue, valueToChar } from '@/utils'
import { imageData, frames } from '@/imageData'
import { characterSet } from '@/settings'

function main(pos, context) {
  // Use animated frames if available
  const data = frames && frames.length > 0
    ? frames[context.frame % frames.length]
    : imageData

  const value = getImageValue(data, pos.x, pos.y)
  return { char: valueToChar(value, characterSet) }
}`,
    importStatement:
      "import { getImageValue } from '@/utils'\nimport { characterSet } from '@/settings'",
  },
  {
    name: 'simplex-noise',
    description:
      'Generates smooth, continuous noise values\nfor procedural textures and patterns',
    type: 'createNoise2D: () => (x: number, y: number) => number',
    example: `function boot() {
  noise2D = createNoise2D()
}

function main(coord, context, cursor, buffer) {
  const noise = noise2D(coord.x * 0.01, coord.y * 0.01)
  return noise > 0 ? 1 : 0
}`,
    importStatement: "import { createNoise2D } from 'simplex-noise'",
  },
] as const
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
  const [utilsOpen, setUtilsOpen] = useState(false)
  const [autoRun, setAutoRun] = useState(true)
  const updateTimeoutRef = useRef<number>(null)

  const handleUndo = () => editorViewRef.current && undo(editorViewRef.current)
  const handleRedo = () => editorViewRef.current && redo(editorViewRef.current)
  const handleCodeRun = () => updateSettings({ code: pendingCode })
  const handleCodeChange = (value: string) => flushSync(() => setPendingCode(value))

  const addImport = (importStatement: string) => {
    if (!editorViewRef.current) return

    const currentContent = editorViewRef.current.state.doc.toString()

    // Check if import already exists
    if (currentContent.includes(importStatement)) {
      return
    }

    // Always add import at the beginning of the file
    const insertText = `${importStatement}\n`

    // Apply change
    const transaction = editorViewRef.current.state.update({
      changes: { from: 0, insert: insertText },
    })
    editorViewRef.current.dispatch(transaction)

    const newContent = transaction.state.doc.toString()
    flushSync(() => setPendingCode(newContent))
  }

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

  const updateControlVariable = (controlId: string, newValue: ControlValue) => {
    if (!editorViewRef.current) return

    // Re-parse the editor's own document so positions are exact for what we edit
    const currentContent = editorViewRef.current.state.doc.toString()
    const control = parseControlVariables(currentContent).find((c) => c.id === controlId)

    if (!control) return

    // Clear pending timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
      updateTimeoutRef.current = null
    }

    // Apply change
    const transaction = editorViewRef.current.state.update({
      changes: {
        from: control.from,
        to: control.to,
        insert: formatControlValue(control, newValue),
      },
    })
    editorViewRef.current.dispatch(transaction)

    const newContent = transaction.state.doc.toString()
    flushSync(() => setPendingCode(newContent))

    // Debounced auto-run
    if (autoRun) {
      updateTimeoutRef.current = window.setTimeout(() => {
        updateSettings({ data: null, code: newContent })
        updateTimeoutRef.current = null
      }, 100)
    }
  }

  const renderControl = (control: ControlVariable) => {
    const controlKey = control.id

    const controlLabel = control.name
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()

    const controlProps = {
      onChange: (val: ControlValue) => updateControlVariable(controlKey, val),
      children: controlLabel,
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
          <div className="font-mono text-[11px] text-tertiary uppercase">{groupName}</div>
        )}
        <div className={groupName !== 'root' ? 'dedent' : ''}>
          <div className="space-y-2">
            {group.controls.map(renderControl)}
            {Object.entries(group.nested).map(([nestedName, nestedControls]) => (
              <div key={nestedName} className="space-y-2">
                <div className="font-mono text-[11px] text-tertiary uppercase">
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
          className="absolute top-0 -left-2 z-10 h-full w-4 cursor-ew-resize"
          onMouseDown={startResize}
        />

        <div className="flex h-full flex-col">
          <div className="flex gap-2 border-b border-default px-4 py-3">
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

          <div className="border-t border-default">
            <button
              onClick={() => setUtilsOpen(!utilsOpen)}
              className="flex w-full items-center justify-between bg-raise px-4 py-1 font-mono text-[11px] tracking-wider text-default uppercase hover:bg-hover"
            >
              Utils
              <DirectionDownIcon
                className={cn(
                  'text-quaternary transition-transform',
                  utilsOpen ? '' : '-rotate-90',
                )}
              />
            </button>
            {utilsOpen && (
              <div className="max-h-[40vh] overflow-auto border-t border-default">
                <div className="px-3 py-3">
                  <Accordion.Root type="single" collapsible className="space-y-2">
                    {UTILS.map((util) => (
                      <Accordion.Item
                        key={util.name}
                        value={util.name}
                        className="rounded border border-default"
                      >
                        <Accordion.Header>
                          <Accordion.Trigger className="flex w-full items-center justify-between rounded px-2 py-1.5 font-mono text-[11px] tracking-wider text-default uppercase hover:bg-hover data-[state=open]:rounded-b-none [&_svg]:-rotate-90 [&_svg]:data-[state=open]:rotate-0">
                            <div className="flex items-center gap-1">
                              <DirectionDownIcon className="text-quaternary transition-transform" />
                              <span>{util.name}</span>
                            </div>
                          </Accordion.Trigger>
                        </Accordion.Header>
                        <Accordion.Content className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden border-t border-default">
                          <div className="space-y-2 px-3 py-3">
                            <div className="text-[12px] tracking-wide text-secondary">
                              {util.description}
                            </div>
                            <div className="space-y-1">
                              <div className="font-mono text-[10px] tracking-wider text-tertiary uppercase">
                                Type
                              </div>
                              <pre className="overflow-x-auto rounded border border-secondary bg-raise px-2 py-1 font-mono text-[10px] text-default">
                                {util.type}
                              </pre>
                            </div>
                            <div className="space-y-1">
                              <div className="font-mono text-[10px] tracking-wider text-tertiary uppercase">
                                Example
                              </div>
                              <pre className="overflow-x-auto rounded border border-secondary bg-raise px-2 py-1 font-mono text-[10px] text-default">
                                {util.example}
                              </pre>
                            </div>
                            <InputButton
                              variant="secondary"
                              onClick={() => {
                                addImport(util.importStatement)
                              }}
                              className="flex items-center gap-1.5"
                            >
                              Import <AddRoundel12Icon className="text-quaternary" />
                            </InputButton>
                          </div>
                        </Accordion.Content>
                      </Accordion.Item>
                    ))}
                  </Accordion.Root>
                </div>
              </div>
            )}
          </div>

          {controlVariables.length > 0 && (
            <div className="border-t border-default">
              <button
                onClick={() => setControlsOpen(!controlsOpen)}
                className="flex w-full items-center justify-between space-y-3 bg-raise px-4 py-1 font-mono text-[11px] tracking-wider text-default uppercase hover:bg-hover"
              >
                Controls
                <DirectionDownIcon
                  className={cn(
                    'text-quaternary transition-transform',
                    controlsOpen ? '' : '-rotate-90',
                  )}
                />
              </button>
              {controlsOpen && (
                <>
                  <div className="max-h-[50vh] space-y-3 overflow-auto border-t border-default px-4 py-3">
                    {Object.entries(groupedControls).map(([groupName, group]) =>
                      renderControlGroup(groupName, group),
                    )}
                  </div>
                  <div className="border-t border-default px-4 py-2">
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
