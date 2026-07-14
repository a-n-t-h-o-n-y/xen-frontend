import { useEffect, useId, useRef, useState } from 'react'

export type ListboxPickerOption = {
  id: string
  name: string
}

type ListboxPickerProps = {
  options: ListboxPickerOption[]
  selectedId: string | null
  selectedName: string
  disabled?: boolean
  triggerLabel: string
  listLabel: string
  className?: string
  onSelect: (id: string) => void | Promise<void>
}

export function ListboxPicker({
  options,
  selectedId,
  selectedName,
  disabled = false,
  triggerLabel,
  listLabel,
  className,
  onSelect,
}: ListboxPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    const selectedIndex = Math.max(0, options.findIndex((option) => option.id === selectedId))
    window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus())

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, options, selectedId])

  const focusOption = (index: number): void => {
    const wrappedIndex = (index + options.length) % options.length
    optionRefs.current[wrappedIndex]?.focus()
  }

  return (
    <div className={`listboxPicker${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="listboxPickerTrigger"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          setOpen(true)
        }}
        disabled={disabled}
        aria-label={triggerLabel}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? listboxId : undefined}
      >
        <span className="listboxPickerValue">{selectedName}</span>
        <span className="listboxPickerChevron" aria-hidden="true" />
      </button>
      {open && !disabled ? (
        <div
          id={listboxId}
          className="listboxPickerMenu"
          role="listbox"
          aria-label={listLabel}
        >
          {options.map((option, index) => (
            <button
              key={option.id}
              ref={(element) => { optionRefs.current[index] = element }}
              type="button"
              className="listboxPickerOption"
              role="option"
              aria-selected={option.id === selectedId}
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
                if (option.id !== selectedId) void onSelect(option.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  focusOption(index + 1)
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  focusOption(index - 1)
                } else if (event.key === 'Home') {
                  event.preventDefault()
                  focusOption(0)
                } else if (event.key === 'End') {
                  event.preventDefault()
                  focusOption(options.length - 1)
                }
              }}
            >
              <span>{option.name}</span>
              <span className="listboxPickerCheck" aria-hidden="true">
                {option.id === selectedId ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
