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
