import { redo, undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import {
  AutoRestart12Icon,
  Info12Icon,
  OpenLink12Icon,
} from '@oxide/design-system/icons/react'
import { useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { InputButton } from '~/lib/ui/src'
import { LinkButton } from '~/lib/ui/src/components/InputButton/InputButton'

import type { SourceType } from './ascii-art-generator'
import CodeEditor from './code-editor'

interface CodeSidebarProps {
  isOpen: boolean
  settings: {
    type: SourceType
    data: string | null
    code: string
  }
  updateSettings: (
    settings: Partial<{
      type: SourceType
      data: string | null
      code: string
    }>,
  ) => void
}

export function CodeSidebar({ isOpen, settings, updateSettings }: CodeSidebarProps) {
  const [pendingCode, setPendingCode] = useState(settings.code)
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

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return
    const newWidth = window.innerWidth - e.clientX
    setWidth(Math.min(Math.max(newWidth, 300), 800)) // Min 300px, max 800px
  }

  const stopResize = () => {
    isDragging.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
  }

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stopResize)
    }
  }, [])

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
