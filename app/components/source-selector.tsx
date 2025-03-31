import { DocumentApi16Icon } from '@oxide/design-system/icons/react'
import type React from 'react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { InputButton } from '~/lib/ui/src'

import type { SourceType } from './ascii-art-generator'
import { Container } from './container'

export function SourceSelector({
  settings,
  updateSettings,
  setShowCodeSidebar,
  showCodeSidebar,
}: {
  setShowCodeSidebar: (val: boolean) => void
  showCodeSidebar: boolean
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
}) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    const validImageTypes = ['image/jpeg', 'image/png']
    const validGifTypes = ['image/gif']

    // Auto-detect file type
    if (validGifTypes.includes(file.type)) {
      // It's a GIF
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        updateSettings({ data: result, type: 'gif', code: '' })
        setShowCodeSidebar(false)
      }
      reader.readAsDataURL(file)
    } else if (validImageTypes.includes(file.type)) {
      // It's a static image
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        updateSettings({ data: result, type: 'image', code: '' })
        setShowCodeSidebar(false)
      }
      reader.readAsDataURL(file)
    } else {
      toast('Please upload an image (JPG, PNG) or a GIF file.')
    }
  }

  const handleButtonClick = () => {
    inputRef.current?.click()
  }
  return (
    <Container className="border-default border-b py-3">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif"
          onChange={handleChange}
        />

        <InputButton
          variant={dragActive ? 'secondary' : 'default'}
          onClick={handleButtonClick}
        >
          {settings.data ? 'Replace Media' : 'Upload Media'}
        </InputButton>
        <InputButton
          variant="secondary"
          inline
          icon
          onClick={() => setShowCodeSidebar(!showCodeSidebar)}
        >
          <DocumentApi16Icon className="text-secondary" />
        </InputButton>
      </div>
    </Container>
  )
}
