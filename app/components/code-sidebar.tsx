import { useState } from 'react'

import type { SourceType } from './ascii-art-generator'
import CodeEditor from './code-editor'
import { Button } from './ui/button'
import { Label } from './ui/label'

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

  const handleCodeRun = () => {
    updateSettings({ code: pendingCode, type: 'code' })
  }

  const handleCodeChange = (value: string) => {
    setPendingCode(value)
  }

  if (!isOpen) return null

  return (
    <div className="w-1/2 max-w-[30rem] overflow-auto border-l bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <Label>Code Input</Label>
        <Button
          size="sm"
          onClick={handleCodeRun}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Run
        </Button>
      </div>
      <CodeEditor value={pendingCode} onChange={handleCodeChange} />
    </div>
  )
}
