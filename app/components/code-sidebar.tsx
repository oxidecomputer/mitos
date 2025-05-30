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
}

function parseControlVariables(code: string): ControlVariable[] {
  const lines = code.split('\n')
  const controls: ControlVariable[] = []

  lines.forEach((line, lineIndex) => {
    // Match: const varName = value //~ type params... (semicolon optional)
    const match = line.match(/const\s+(\w+)\s*=\s*(.+?);?\s*\/\/~\s*(.+)/)
    if (!match) return

    const [, name, valueStr, controlConfig] = match

    const parts = controlConfig.trim().split(/\s+/)
    if (parts.length === 0) return

    const type = parts[0] as ControlVariable['type']
    let value: string | number | boolean
    let min: number | undefined
    let max: number | undefined
    let step: number | undefined

    if (type === 'boolean') {
      value = valueStr.trim() === 'true'
    } else if (type === 'number') {
      value = parseFloat(valueStr.trim())

      // Parse range (e.g., "0-10")
      const rangeMatch = controlConfig.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/)
      if (rangeMatch) {
        min = parseFloat(rangeMatch[1])
        max = parseFloat(rangeMatch[2])
      }

      // Parse step (e.g., "step=0.5")
      const stepMatch = controlConfig.match(/step=(\d+(?:\.\d+)?)/)
      if (stepMatch) {
        step = parseFloat(stepMatch[1])
      }
    } else if (type === 'text') {
      // String - remove quotes
      value = valueStr.trim().replace(/^['"`]|['"`]$/g, '')
    } else {
      return // Unknown type
    }

    // Find the position of the value in the line for replacement
    const valueStart = line.indexOf(valueStr)
    const valueEnd = valueStart + valueStr.length

    controls.push({
      name,
      value,
      type,
      step,
      min,
      max,
      line: lineIndex,
      startPos: valueStart,
      endPos: valueEnd,
    })
  })

  return controls
}

export function CodeSidebar({
  isOpen,
  pendingCode,
  setPendingCode,
  updateSettings,
}: CodeSidebarProps) {
  const [width, setWidth] = useState(400) // Default width of 400px
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const editorViewRef = useRef<EditorView | null>(null)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [autoRun, setAutoRun] = useState(true)

  const handleUndo = () => {
    if (editorViewRef.current) {
      undo(editorViewRef.current)
    }
  }

  const handleRedo = () => {
    if (editorViewRef.current) {
      redo(editorViewRef.current)
    }
  }

  const handleCodeRun = () => {
    updateSettings({ data: null, code: pendingCode, type: 'code' })
  }

  const handleCodeChange = (value: string) => {
    setPendingCode(value)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const newWidth = window.innerWidth - e.clientX
    setWidth(Math.min(Math.max(newWidth, 300), 800)) // Min 300px, max 800px
  }, [])

  const stopResize = useCallback(() => {
    isDragging.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
  }, [handleMouseMove])

  const controlVariables = useMemo(() => parseControlVariables(pendingCode), [pendingCode])

  const updateControlVariable = (
    controlName: string,
    newValue: string | number | boolean,
  ) => {
    const control = controlVariables.find((c) => c.name === controlName)
    if (!control) return

    const lines = pendingCode.split('\n')

    // Format the new value based on type
    let formattedValue: string
    if (control.type === 'boolean') {
      formattedValue = String(newValue)
    } else if (control.type === 'number') {
      formattedValue = String(newValue)
    } else {
      formattedValue = `'${newValue}'`
    }

    // Calculate the exact character positions in the document
    const lineStart = lines
      .slice(0, control.line)
      .reduce((acc, line) => acc + line.length + 1, 0)
    const changeStart = lineStart + control.startPos
    const changeEnd = lineStart + control.endPos

    // Only update the specific value, not the entire document
    // If we update the whole document with `setPendingCode`
    // we get a scroll jump
    if (editorViewRef.current) {
      const transaction = editorViewRef.current.state.update({
        changes: { from: changeStart, to: changeEnd, insert: formattedValue },
      })
      editorViewRef.current.dispatch(transaction)

      if (autoRun) {
        updateSettings({ data: null, code: transaction.state.doc.toString(), type: 'code' })
      }
    }
  }

  // Render controls in the sidebar
  const renderControl = (control: ControlVariable) => {
    switch (control.type) {
      case 'text':
        return (
          <InputText
            value={control.value as string}
            onChange={(val) => updateControlVariable(control.name, val)}
          >
            {control.name}
          </InputText>
        )
      case 'number':
        return (
          <InputNumber
            value={control.value as number}
            min={control.min}
            max={control.max}
            onChange={(val) => updateControlVariable(control.name, val)}
            step={control.step}
          >
            {control.name}
          </InputNumber>
        )
      case 'boolean':
        return (
          <InputSwitch
            checked={control.value as boolean}
            onChange={(checked) => updateControlVariable(control.name, checked)}
          >
            {control.name}
          </InputSwitch>
        )
      default:
        return null
    }
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
  }

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stopResize)
    }
  }, [handleMouseMove, stopResize])

  // shift+r runs code
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

  if (!isOpen) return null

  return (
    <div
      ref={sidebarRef}
      className="bg-background relative overflow-hidden border-l border-default"
      style={{ width: `${width}px` }}
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

        <div className="flex-1 overflow-scroll">
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
                <div className="space-y-3 border-t px-4 py-3 border-default">
                  {controlVariables.map((control) => (
                    <div key={control.name}>{renderControl(control)}</div>
                  ))}
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
    </div>
  )
}
