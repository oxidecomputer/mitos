import { useState } from 'react'

import { InputButton } from '~/lib/ui/src'

import type { SourceType } from './ascii-art-generator'
import CodeEditor from './code-editor'

interface CodeSidebarProps {
  isOpen: boolean
  setShowCodeSidebar: (val: boolean) => void
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

export function CodeSidebar({
  isOpen,
  setShowCodeSidebar,
  settings,
  updateSettings,
}: CodeSidebarProps) {
  const [pendingCode, setPendingCode] = useState(settings.code)

  const handleCodeRun = () => {
    updateSettings({ code: pendingCode, type: 'code' })
  }

  const handleCodeChange = (value: string) => {
    setPendingCode(value)
  }

  console.log(isOpen)

  return (
    <div className="relative">
      <div className="absolute -left-3 top-3 -translate-x-[100%]">
        <InputButton onClick={() => setShowCodeSidebar(!isOpen)} inline>
          {isOpen ? 'Hide' : 'Show'}
        </InputButton>
      </div>
      {isOpen && (
        <div className="relative w-full max-w-[30rem] overflow-auto border-l bg-background">
          <CodeEditor value={pendingCode} onChange={handleCodeChange} />
          <InputButton
            inline
            onClick={handleCodeRun}
            className="absolute bottom-2 right-2 w-auto"
          >
            Run
          </InputButton>
        </div>
      )}
    </div>
  )
}
