import { Label } from '~/components/ui/label'
import { Slider } from '~/components/ui/slider'
import { Switch } from '~/components/ui/switch'

interface PreprocessingControlsProps {
  settings: {
    brightness: number
    whitePoint: number
    blackPoint: number
    blur: number
    invert: boolean
    dithering: boolean
    ditheringAlgorithm: 'floydSteinberg' | 'atkinson' | 'ordered' | 'bayer'
  }
  updateSettings: (
    settings: Partial<{
      brightness: number
      whitePoint: number
      blackPoint: number
      blur: number
      invert: boolean
      dithering: boolean
      ditheringAlgorithm: 'floydSteinberg' | 'atkinson' | 'ordered' | 'bayer'
    }>,
  ) => void
}

export function PreprocessingControls({
  settings,
  updateSettings,
}: PreprocessingControlsProps) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-medium">Preprocessing</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="brightness">Brightness</Label>
            <span className="text-sm text-muted-foreground">{settings.brightness}</span>
          </div>
          <Slider
            id="brightness"
            min={-100}
            max={100}
            step={1}
            value={[settings.brightness]}
            onValueChange={(value) => updateSettings({ brightness: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="whitePoint">White Point</Label>
            <span className="text-sm text-muted-foreground">{settings.whitePoint}</span>
          </div>
          <Slider
            id="whitePoint"
            min={0}
            max={255}
            step={1}
            value={[settings.whitePoint]}
            onValueChange={(value) => updateSettings({ whitePoint: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="blackPoint">Black Point</Label>
            <span className="text-sm text-muted-foreground">{settings.blackPoint}</span>
          </div>
          <Slider
            id="blackPoint"
            min={0}
            max={255}
            step={1}
            value={[settings.blackPoint]}
            onValueChange={(value) => updateSettings({ blackPoint: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="blur">Blur</Label>
            <span className="text-sm text-muted-foreground">{settings.blur}px</span>
          </div>
          <Slider
            id="blur"
            min={0}
            max={20}
            step={0.1}
            value={[settings.blur]}
            onValueChange={(value) => updateSettings({ blur: value[0] })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="invert">Invert Colors</Label>
          <Switch
            id="invert"
            checked={settings.invert}
            onCheckedChange={(checked) => updateSettings({ invert: checked })}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="dithering">Dithering</Label>
          <Switch
            id="dithering"
            checked={settings.dithering}
            onCheckedChange={(checked) => updateSettings({ dithering: checked })}
          />
        </div>
        
        {settings.dithering && (
          <div className="space-y-2">
            <Label htmlFor="ditheringAlgorithm">Dithering Algorithm</Label>
            <select
              id="ditheringAlgorithm"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={settings.ditheringAlgorithm}
              onChange={(e) => updateSettings({ ditheringAlgorithm: e.target.value as any })}
            >
              <option value="floydSteinberg">Floyd-Steinberg</option>
              <option value="atkinson">Atkinson</option>
              <option value="ordered">Ordered</option>
              <option value="bayer">Bayer</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
