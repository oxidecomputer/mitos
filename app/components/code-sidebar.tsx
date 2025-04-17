/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { redo, undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { Info12Icon } from '@oxide/design-system/icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { InputButton } from '~/lib/ui/src'
import { LinkButton } from '~/lib/ui/src/components/InputButton/InputButton'

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
      className="bg-background relative border-l border-default"
      style={{ width: `${width}px` }}
    >
      <div
        className="absolute -left-2 top-0 z-10 h-full w-4 cursor-ew-resize"
        onMouseDown={startResize}
      />
      <CodeEditor
        value={pendingCode}
        onChange={handleCodeChange}
        editorViewRef={editorViewRef}
      />
      <div className="absolute left-10 top-2 z-30 flex items-center gap-1 rounded-md border p-2 bg-raise border-default">
        <InputButton inline onClick={handleCodeRun} className="!h-6">
          Run
        </InputButton>
        <InputButton variant="secondary" icon className="!h-6" onClick={handleUndo}>
          Undo
        </InputButton>
        <InputButton variant="secondary" icon className="!h-6" onClick={handleRedo}>
          Redo
        </InputButton>
      </div>

      <div className="absolute right-4 top-4 z-30 flex items-center">
        <LinkButton
          to="https://play.ertdfgcvb.xyz/abc.html"
          variant="secondary"
          icon
          className="!h-6 gap-1"
          onClick={handleRedo}
        >
          About <Info12Icon className="text-quaternary" />
        </LinkButton>
      </div>
    </div>
  )
}
