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

import { parseGridConfig, type GridConfig } from '~/lib/grid-config'
import { InputButton } from '~/lib/ui/src'

import { Container } from './container'
import { PasteConfirmationDialog } from './paste-confirmation'

export function SourceSelector({
  settings,
  setShowCodeSidebar,
  showCodeSidebar,
  processFile,
  onGridConfig,
}: {
  setShowCodeSidebar: (val: boolean) => void
  showCodeSidebar: boolean
  settings: {
    data: string | null
    code: string
    fileName: string | null
  }
  processFile: (file: File, dataUrl?: string) => boolean // Add this prop type
  onGridConfig: (config: GridConfig) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [pastedImage, setPastedImage] = useState<{
    previewUrl: string
    file: File
  } | null>(null)

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

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      // Pasting into a text field keeps its default behaviour
      const target = e.target as HTMLElement | null
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      // A grid config copied from the ox-dual-grid Figma plugin arrives as
      // JSON text; it merges into the settings rather than replacing them
      const text = e.clipboardData?.getData('text/plain')
      if (!isEditable && text) {
        const config = parseGridConfig(text)
        if (config) {
          e.preventDefault()
          onGridConfig(config)
          return
        }
      }

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
    },
    [onGridConfig],
  )

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
    <Container className="border-b border-default py-3">
      <div className="flex gap-2">
        <input
          key="file-input"
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif"
          onChange={handleChange}
        />

        <InputButton variant="default" onClick={handleButtonClick}>
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
      {settings.data && (
        <div className="!mt-2 line-clamp-1 flex items-center gap-0.5 font-mono [font-size:10px] text-quaternary uppercase">
          <div className="text-secondary">Source:</div>
          <div className="flex-grow truncate text-ellipsis">{settings.fileName}</div>
          {/*<button className="ml-1 flex items-center justify-center rounded border p-1 text-secondary border-default hover:bg-hover">
            <Close8Icon />
          </button>*/}
        </div>
      )}
    </Container>
  )
}
