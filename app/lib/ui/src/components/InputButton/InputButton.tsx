/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import './InputButton.css'

import { cn } from '~/lib/utils'

export type ButtonVariant = 'default' | 'secondary'

export interface InputButtonProps {
  children?: React.ReactNode
  disabled?: boolean
  variant?: ButtonVariant
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit' | 'reset'
  inline?: boolean
  icon?: boolean
}

export const InputButton = ({
  children,
  disabled = false,
  variant = 'default',
  onClick,
  className = '',
  type = 'button',
  inline = false,
  icon = false,
}: InputButtonProps) => {
  return (
    <button
      type={type}
      className={cn(
        'ui-button',
        `ui-button--${variant}`,
        inline && 'ui-button--inline',
        icon && 'ui-button--icon',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export const LinkButton = ({
  children,
  variant = 'default',
  onClick,
  className = '',
  to,
  inline = false,
  icon = false,
}: Omit<InputButtonProps, 'type' | 'disabled'> & { to: string }) => {
  return (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'ui-button',
        `ui-button--${variant}`,
        inline && 'ui-button--inline',
        icon && 'ui-button--icon',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </a>
  )
}
