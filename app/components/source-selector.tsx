import cn from 'clsx'
import { Upload } from 'lucide-react'
import type React from 'react'
import { useRef, useState } from 'react'

import { Button } from '~/components/ui/button'
import { useToast } from '~/components/ui/use-toast'

import type { SourceType } from './ascii-art-generator'

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
    const validImageTypes = ['image/jpeg', 'image/png']
    const validGifTypes = ['image/gif']
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']

    // Determine acceptable file types based on source type
    let acceptableTypes: string[] = []
    let typeDescription = ''

    switch (type) {
      case 'image':
        acceptableTypes = validImageTypes
        typeDescription = 'JPG or PNG'
        break
      case 'gif':
        acceptableTypes = validGifTypes
        typeDescription = 'GIF'
        break
      case 'video':
        acceptableTypes = validVideoTypes
        typeDescription = 'MP4, WebM, or QuickTime'
        break
      default:
        acceptableTypes = []
    }

    if (type !== 'code' && !acceptableTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: `Please upload a ${typeDescription} file.`,
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      updateSettings({ data: result, type })
    }
    reader.readAsDataURL(file)
  }

  const handleButtonClick = () => {
    inputRef.current?.click()
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
          accept={
            type === 'image'
              ? '.jpg,.jpeg,.png'
              : type === 'gif'
                ? '.gif'
                : type === 'video'
                  ? '.mp4,.webm,.mov,.qt'
                  : '.jpg,.jpeg,.png,.gif,.mp4,.webm,.mov,.qt'
          }
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
          {settings.data ? 'Replace' : 'Upload'}{' '}
          {type === 'image'
            ? 'Image'
            : type === 'gif'
              ? 'GIF'
              : type === 'video'
                ? 'Video'
                : 'File'}
        </Button>
      </div>
    </div>
  )
}
