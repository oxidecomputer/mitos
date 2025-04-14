/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { DocumentApi16Icon } from '@oxide/design-system/icons/react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import { InputButton } from '~/lib/ui/src'

import type { SourceType } from './ascii-art-generator'
import { Container } from './container'
import { PasteConfirmationDialog } from './paste-confirmation'

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

  const [pastedImage, setPastedImage] = useState<{
    previewUrl: string
    file: File
  } | null>(null)

  const processFile = useCallback(
    (file: File, dataUrl?: string) => {
      const validImageTypes = ['image/jpeg', 'image/png']
      const validGifTypes = ['image/gif']

      if (validGifTypes.includes(file.type)) {
        // It's a GIF
        if (dataUrl) {
          // If we already have the dataUrl (from paste preview)
          updateSettings({ data: dataUrl, type: 'gif' })
          setShowCodeSidebar(false)
        } else {
          // Read the file to get dataUrl
          const reader = new FileReader()
          reader.onload = (e) => {
            const result = e.target?.result as string
            updateSettings({ data: result, type: 'gif' })
            setShowCodeSidebar(false)
          }
          reader.readAsDataURL(file)
        }
        return true
      } else if (validImageTypes.includes(file.type)) {
        // It's a static image
        if (dataUrl) {
          // If we already have the dataUrl (from paste preview)
          updateSettings({ data: dataUrl, type: 'image' })
          setShowCodeSidebar(false)
        } else {
          // Read the file to get dataUrl
          const reader = new FileReader()
          reader.onload = (e) => {
            const result = e.target?.result as string
            updateSettings({ data: result, type: 'image' })
            setShowCodeSidebar(false)
          }
          reader.readAsDataURL(file)
        }
        return true
      } else {
        toast('Please upload an image (JPG, PNG) or a GIF file.')
        return false
      }
    },
    [updateSettings, setShowCodeSidebar],
  )

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
    processFile(file)
  }

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const clipboardItems = e.clipboardData?.items
    if (!clipboardItems) return

    // Check for images in the clipboard
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i]

      if (item.type.indexOf('image') !== -1) {
        e.preventDefault() // Prevent default paste behavior

        const file = item.getAsFile()
        if (!file) continue

        // Create a preview URL for the confirmation dialog
        const reader = new FileReader()
        reader.onload = (e) => {
          const previewUrl = e.target?.result as string
          setPastedImage({ previewUrl, file })
        }
        reader.readAsDataURL(file)
        return
      }
    }
  }, [])

  const confirmPastedImage = useCallback(() => {
    if (!pastedImage) return
    processFile(pastedImage.file, pastedImage.previewUrl)
    setPastedImage(null)
  }, [pastedImage, processFile])

  const cancelPastedImage = useCallback(() => {
    setPastedImage(null)
  }, [])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [handlePaste])

  const handleButtonClick = () => {
    inputRef.current?.click()
  }

  // open file input with cmd+o
  useHotkeys('meta+o', handleButtonClick, { preventDefault: true }, [])

  return (
    <Container className="border-b py-3 border-default">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className="flex gap-2"
      >
        <input
          key={settings.type}
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
        <PasteConfirmationDialog
          open={!!pastedImage}
          imageUrl={pastedImage && pastedImage.previewUrl}
          onConfirm={confirmPastedImage}
          onCancel={cancelPastedImage}
        />
      </div>
    </Container>
  )
}
