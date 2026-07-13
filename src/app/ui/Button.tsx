import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'secondary' | 'primary' | 'danger' | 'ghost'
  size?: 'small' | 'medium'
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'medium',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`uiButton uiButton-${variant} uiButton-${size}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </button>
  )
}
