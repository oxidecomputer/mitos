import { Save, Upload } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useToast } from '~/components/ui/use-toast'

import type { AsciiSettings } from './ascii-art-generator'

interface ProjectManagementProps {
  settings: AsciiSettings
  updateSettings: (settings: Partial<AsciiSettings>) => void
}

export function ProjectManagement({ settings, updateSettings }: ProjectManagementProps) {
  const [projectName, setProjectName] = useState('My ASCII Project')
  const { toast } = useToast()

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

      toast({
        title: 'Project saved',
        description: `${projectName} has been saved to your device.`,
      })
    } catch (error) {
      toast({
        title: 'Error saving project',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
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

          toast({
            title: 'Project loaded',
            description: `${projectData.name} has been loaded successfully.`,
          })
        } catch (error) {
          toast({
            title: 'Error parsing project file',
            description: 'The selected file is not a valid project file.',
            variant: 'destructive',
          })
        }
      }
      reader.readAsText(file)
    } catch (error) {
      toast({
        title: 'Error loading project',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Input
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name"
          />
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSaveProject}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>

          <Button className="flex-1" asChild>
            <label>
              <Upload className="mr-2 h-4 w-4" />
              Load
              <input
                type="file"
                className="hidden"
                accept=".json"
                onChange={handleLoadProject}
              />
            </label>
          </Button>
        </div>
      </div>
    </div>
  )
}
