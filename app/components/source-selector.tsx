import cn from 'clsx'
import { Upload } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { useToast } from '~/components/ui/use-toast'

import type { SourceType } from './ascii-art-generator'
import CodeEditor from './code-editor'

interface SourceSelectorProps {
  type: SourceType
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

export function SourceSelector({ type, settings, updateSettings }: SourceSelectorProps) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = (files: FileList) => {
    const file = files[0]
    const validTypes = ['image/jpeg', 'image/png']

    if (type !== 'code' && !validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: `Please upload a ${type === 'image' ? 'JPG or PNG' : 'MP4'} file.`,
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      updateSettings({ data: result })
    }
    reader.readAsDataURL(file)
  }

  const handleButtonClick = () => {
    inputRef.current?.click()
  }

  const [pendingCode, setPendingCode] = useState(settings.code)

  const handleCodeRun = () => {
    updateSettings({ code: pendingCode })
  }

  const handleCodeChange = (value: string) => {
    setPendingCode(value)
  }

  // Update local state when settings change (e.g. switching tabs)
  useEffect(() => {
    setPendingCode(settings.code)
  }, [settings.code])

  if (type === 'code') {
    return (
      <div>
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

  return (
    <div>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png"
          onChange={handleChange}
        />

        <Button
          onClick={handleButtonClick}
          className={cn(
            'w-full transition-colors',
            dragActive && 'border-dashed bg-primary/10 text-primary',
          )}
        >
          <Upload className="mr-2 h-4 w-4" />
          {settings.data ? 'Replace' : 'Upload'} Image
        </Button>
      </div>
    </div>
  )
}
