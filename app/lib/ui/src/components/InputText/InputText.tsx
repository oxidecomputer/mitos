/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import './InputText.css'

export interface InputTextProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  type?: 'text' | 'password' | 'email' | 'tel'
  children?: React.ReactNode
}

export const InputText = ({
  value,
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  type = 'text',
  children,
}: InputTextProps) => {
  const inputClasses = ['ui-text', className].filter(Boolean).join(' ')

  return (
    <div className={inputClasses}>
      {children && <label className="ui-text__label">{children}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}
