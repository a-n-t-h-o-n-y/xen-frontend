import type { ReactNode } from 'react'

type FormFieldProps = {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}

export function FormField({ label, children, hint, className = '' }: FormFieldProps) {
  return (
    <label className={`uiFormField${className ? ` ${className}` : ''}`}>
      <span className="uiFormFieldLabel">{label}</span>
      {children}
      {hint ? <small className="uiFormFieldHint">{hint}</small> : null}
    </label>
  )
}
