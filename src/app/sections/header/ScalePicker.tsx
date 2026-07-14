import { useEffect, useId, useRef, useState } from 'react'

type ScaleOption = {
  id: string
  name: string
}

type ScalePickerProps = {
  options: ScaleOption[]
  selectedId: string | null
  selectedName: string
  disabled: boolean
  onSelect: (id: string) => Promise<void>
}

export function ScalePicker({
  options,
  selectedId,
  selectedName,
  disabled,
  onSelect,
}: ScalePickerProps) {
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
    <div className="scalePicker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="scalePickerTrigger"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          setOpen(true)
        }}
        disabled={disabled}
        aria-label="Select active scale"
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? listboxId : undefined}
      >
        <span className="scalePickerValue">{selectedName}</span>
        <span className="scalePickerChevron" aria-hidden="true" />
      </button>
      {open && !disabled ? (
        <div
          id={listboxId}
          className="scalePickerMenu"
          role="listbox"
          aria-label="Available scales"
        >
          {options.map((option, index) => (
            <button
              key={option.id}
              ref={(element) => { optionRefs.current[index] = element }}
              type="button"
              className="scalePickerOption"
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
              <span className="scalePickerCheck" aria-hidden="true">
                {option.id === selectedId ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
