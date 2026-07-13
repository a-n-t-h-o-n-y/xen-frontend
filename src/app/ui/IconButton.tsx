import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
  size?: 'small' | 'medium'
}

export function IconButton({
  label,
  children,
  size = 'medium',
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`uiIconButton uiIconButton-${size}${className ? ` ${className}` : ''}`}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  )
}
