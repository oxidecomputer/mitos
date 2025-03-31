import type React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { InputButton } from '~/lib/ui/src'
import { InputText } from '~/lib/ui/src/components/InputText/InputText'

import type { AsciiSettings } from './ascii-art-generator'
import { Container } from './container'

interface ProjectManagementProps {
  settings: AsciiSettings
  updateSettings: (settings: Partial<AsciiSettings>) => void
}

export function ProjectManagement({ settings, updateSettings }: ProjectManagementProps) {
  const [projectName, setProjectName] = useState('My ASCII Project')

  const handleSaveProject = () => {
    try {
      const projectData = {
        name: projectName,
        settings: settings,
      }
      const json = JSON.stringify(projectData)
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

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string
          const projectData = JSON.parse(json)
          setProjectName(projectData.name || 'Imported Project')
          updateSettings(projectData.settings)

          toast(`${projectData.name} has been loaded successfully.`)
        } catch (error) {
          toast('The selected file is not a valid project file')
        }
      }
      reader.readAsText(file)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  return (
    <Container>
      <InputText
        value={projectName}
        onChange={setProjectName}
        placeholder="Enter project name"
      />

      <div className="flex gap-2">
        <InputButton variant="secondary" onClick={handleSaveProject}>
          Save
        </InputButton>
        <InputButton variant="secondary" onClick={handleSaveProject}>
          Load
          <input
            type="file"
            className="hidden"
            accept=".json"
            onChange={handleLoadProject}
          />
        </InputButton>
      </div>
    </Container>
  )
}
