type SegmentedOption<T extends string> = {
  value: T
  label: string
  description?: string
}

type SegmentedControlProps<T extends string> = {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`uiSegmented${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          className="uiSegmentedOption"
          key={option.value}
          aria-pressed={option.value === value}
          title={option.description}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
