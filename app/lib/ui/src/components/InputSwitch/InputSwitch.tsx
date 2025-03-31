import { useState } from 'react'

import './InputSwitch.css'

export interface InputSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}

export const InputSwitch = ({
  checked,
  onChange,
  disabled = false,
  children,
  className = '',
}: InputSwitchProps) => {
  const [subfocus, setSubfocus] = useState(false)
  const [tweakingValue, setTweakingValue] = useState<number | null>(null)

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked)
    }
  }

  const handleMouseDown = () => {
    if (!disabled) {
      setTweakingValue(checked ? 0 : 1)
    }
  }

  const handleMouseUp = () => {
    setTweakingValue(null)
  }

  return (
    <div className={`ui-switch ${className}`.trim()}>
      {children && <label className="ui-switch__label">{children}</label>}
      <div
        className={`ui-switch__track ${subfocus ? 'ui-switch__track--subfocus' : ''}`.trim()}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="ui-switch__input"
          onFocus={() => setSubfocus(true)}
          onBlur={() => setSubfocus(false)}
        />
        <div
          className={`ui-switch__handle ${
            tweakingValue !== null ? 'ui-switch__handle--tweaking' : ''
          }`.trim()}
        />
      </div>
    </div>
  )
}
