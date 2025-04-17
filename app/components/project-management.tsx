/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import type React from 'react'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'

import { InputButton } from '~/lib/ui/src'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'
import { InputText } from '~/lib/ui/src/components/InputText/InputText'
import { TEMPLATES, TemplateType } from '~/templates'

import { type AsciiSettings } from './ascii-art-generator'
import { Container } from './container'

interface ProjectManagementProps {
  settings: AsciiSettings
  setSettings: Dispatch<SetStateAction<AsciiSettings>>
  onCodeProjectLoaded?: (code: string) => void
  projectName: string
  setProjectName: Dispatch<SetStateAction<string>>
  templateType: TemplateType | ''
  setTemplateType: Dispatch<SetStateAction<TemplateType | ''>>
  handleLoadProjectInput: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function ProjectManagement({
  projectName,
  setProjectName,
  templateType,
  setTemplateType,
  settings,
  setSettings,
  handleLoadProjectInput,
}: ProjectManagementProps) {
  const handleTemplateChange = (template: TemplateType) => {
    setTemplateType(template)

    if (template !== 'custom' && TEMPLATES[template]) {
      // Apply template settings
      setSettings(TEMPLATES[template] as AsciiSettings)
      // Update project name
      setProjectName(TEMPLATES[template].meta.name)
      toast(`Applied ${TEMPLATES[template].meta.name} template`)
    }
  }

  const handleSaveProject = () => {
    try {
      const projectData = {
        name: projectName,
        settings: {
          ...settings,
          source: {
            ...settings.source,
            data: '', // dont save the image data
          },
        },
      }
      const json = JSON.stringify(projectData, null, 2)

      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast(`${projectName} has been saved to your device.`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  return (
    <Container>
      <InputSelect<TemplateType>
        value={templateType}
        onChange={handleTemplateChange}
        options={Object.keys(TEMPLATES) as TemplateType[]}
        placeholder="Select or save template"
      >
        Template
      </InputSelect>

      {templateType === 'custom' && (
        <div className="dedent">
          <InputText
            value={projectName}
            onChange={setProjectName}
            placeholder="Enter project name"
          />
          <InputButton variant="secondary" onClick={handleSaveProject}>
            Save
          </InputButton>
        </div>
      )}

      <div className="flex gap-2">
        <InputButton variant="secondary">
          Load
          <input
            type="file"
            className="absolute inset-0 z-10 opacity-0"
            accept=".json"
            onChange={handleLoadProjectInput}
          />
        </InputButton>
      </div>
    </Container>
  )
}
