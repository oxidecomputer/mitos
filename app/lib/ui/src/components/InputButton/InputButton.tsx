import './InputButton.css'

import cn from 'clsx'

export type ButtonVariant = 'default' | 'secondary'

export interface InputButtonProps {
  children?: React.ReactNode
  disabled?: boolean
  variant?: ButtonVariant
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit' | 'reset'
  inline?: boolean
}

export const InputButton = ({
  children,
  disabled = false,
  variant = 'default',
  onClick,
  className = '',
  type = 'button',
  inline = false,
}: InputButtonProps) => {
  return (
    <button
      type={type}
      className={cn(
        'ui-button',
        `ui-button--${variant}`,
        inline && 'ui-button--inline',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
