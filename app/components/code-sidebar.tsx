import { useState } from 'react'

import { InputButton } from '~/lib/ui/src'

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

  const handleCodeRun = () => {
    updateSettings({ data: null, code: pendingCode, type: 'code' })
  }

  const handleCodeChange = (value: string) => {
    setPendingCode(value)
  }

  if (!isOpen) return null

  return (
    <div className="border-default relative w-full max-w-[30rem] border-l bg-background">
      <CodeEditor value={pendingCode} onChange={handleCodeChange} />
      <div className="!absolute -left-2 top-2 -translate-x-[100%]">
        <InputButton inline onClick={handleCodeRun}>
          Run
        </InputButton>
      </div>
    </div>
  )
}
