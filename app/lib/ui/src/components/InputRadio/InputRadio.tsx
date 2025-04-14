/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useId } from 'react'

import './InputRadio.css'

export interface InputRadioProps<T> {
  value: T
  onChange: (value: T) => void
  options: T[]
  labelize?: (value: T) => string
  disabled?: boolean
  className?: string
  children?: (props: { label: string; value: T; isActive: boolean }) => React.ReactNode
}

export const InputRadio = <T extends string | number>({
  value,
  onChange,
  options,
  labelize = (v) => String(v),
  disabled = false,
  className = '',
  children,
}: InputRadioProps<T>) => {
  const id = useId()

  const completeOptions = options.map((option) => ({
    value: option,
    label: labelize(option),
  }))

  return (
    <ul className={`ui-radio ${className}`.trim()}>
      {completeOptions.map(({ value: optionValue, label }) => {
        const isActive = value === optionValue
        return (
          <li key={label} className="ui-radio__item">
            <input
              id={`${id}-${optionValue}`}
              type="radio"
              name={id}
              checked={isActive}
              onChange={() => onChange(optionValue)}
              disabled={disabled}
              className={isActive ? 'ui-radio__input--active' : ''}
            />
            <label
              htmlFor={`${id}-${optionValue}`}
              className={`ui-radio__label ${isActive ? 'ui-radio__label--active' : ''}`.trim()}
            >
              {children ? children({ label, value: optionValue, isActive }) : label}
            </label>
          </li>
        )
      })}
    </ul>
  )
}
