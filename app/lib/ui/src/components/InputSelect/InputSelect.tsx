/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import './InputSelect.css'

export interface InputSelectProps<T> {
  value: T | ''
  onChange: (value: T) => void
  options: T[]
  labelize?: (value: T) => string
  disabled?: boolean
  className?: string
  placeholder?: string
  children?: React.ReactNode
}

export const InputSelect = <T extends string | number>({
  value,
  onChange,
  options,
  labelize = (v) => String(v),
  disabled = false,
  className = '',
  placeholder,
  children,
}: InputSelectProps<T>) => {
  const selectClasses = ['ui-select', className].filter(Boolean).join(' ')

  return (
    <div className={selectClasses}>
      {children && <label className="ui-text__label">{children}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        className={value === '' ? 'ui-select__option-disabled' : ''}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={String(option)} value={option}>
            {labelize(option)}
          </option>
        ))}
      </select>
    </div>
  )
}
