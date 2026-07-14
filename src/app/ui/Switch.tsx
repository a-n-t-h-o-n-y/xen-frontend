type SwitchProps = {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Switch({
  checked,
  label,
  onChange,
  disabled = false,
  className = '',
}: SwitchProps) {
  return (
    <button
      type="button"
      className={`uiSwitch${className ? ` ${className}` : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="uiSwitchThumb" aria-hidden="true" />
    </button>
  )
}
