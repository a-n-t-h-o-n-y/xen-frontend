import { useRef, useState } from 'react'

type ModeStepperProps = {
  options: number[]
  value: number
  placeholder: string
  disabled: boolean
  onChange: (mode: number) => Promise<void>
}

export function ModeStepper({
  options,
  value,
  placeholder,
  disabled,
  onChange,
}: ModeStepperProps) {
  const [draft, setDraft] = useState(options.length > 0 ? String(value) : '')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlurCommitRef = useRef(false)

  const apply = (nextValue: number): void => {
    setDraft(String(nextValue))
    if (nextValue !== value) void onChange(nextValue)
  }

  const step = (direction: -1 | 1): void => {
    if (disabled || options.length === 0) return
    const draftValue = focused ? Number(draft) : value
    const currentIndex = options.indexOf(draftValue)
    const fallbackIndex = Math.max(0, options.indexOf(value))
    const startIndex = currentIndex >= 0 ? currentIndex : fallbackIndex
    const nextIndex = (startIndex + direction + options.length) % options.length
    apply(options[nextIndex] ?? value)
  }

  const commitDraft = (): void => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || options.length === 0) {
      setDraft(options.length > 0 ? String(value) : '')
      return
    }

    const integer = Math.trunc(parsed)
    const exactValue = options.find((option) => option === integer)
    if (exactValue !== undefined) {
      apply(exactValue)
      return
    }

    const first = options[0] ?? value
    const wrappedIndex = ((integer - first) % options.length + options.length) % options.length
    apply(options[wrappedIndex] ?? value)
  }

  return (
    <div className={`modeStepper${disabled ? ' modeStepper-disabled' : ''}`}>
      <input
        ref={inputRef}
        className="modeStepperInput mono"
        type="text"
        role="spinbutton"
        inputMode="numeric"
        value={options.length > 0 ? (focused ? draft : String(value)) : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          if (!focused) setDraft(options.length > 0 ? String(value) : '')
          setFocused(true)
          event.currentTarget.select()
        }}
        onBlur={() => {
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false
            setFocused(false)
            return
          }
          commitDraft()
          setFocused(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            step(1)
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            step(-1)
          } else if (event.key === 'Enter') {
            event.preventDefault()
            skipBlurCommitRef.current = true
            commitDraft()
            setFocused(false)
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            skipBlurCommitRef.current = true
            setDraft(options.length > 0 ? String(value) : '')
            setFocused(false)
            event.currentTarget.blur()
          }
        }}
        disabled={disabled}
        aria-label="Scale mode"
        aria-valuemin={options[0]}
        aria-valuemax={options.at(-1)}
        aria-valuenow={options.includes(focused ? Number(draft) : value)
          ? (focused ? Number(draft) : value)
          : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <span className="modeStepperButtons">
        <button
          type="button"
          className="modeStepperButton modeStepperButton-up"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            inputRef.current?.focus()
            step(1)
          }}
          disabled={disabled}
          aria-label="Next scale mode"
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          className="modeStepperButton modeStepperButton-down"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            inputRef.current?.focus()
            step(-1)
          }}
          disabled={disabled}
          aria-label="Previous scale mode"
        >
          <span aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}
