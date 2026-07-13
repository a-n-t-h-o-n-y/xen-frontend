import type { Dispatch, RefObject, SetStateAction } from 'react'

type EditableHeaderFieldProps = {
  className: string
  label: string
  editing: boolean
  inputRef: RefObject<HTMLInputElement | null>
  draft: string
  setDraft: Dispatch<SetStateAction<string>>
  commit: (value: string) => Promise<unknown>
  cancel: () => void
  begin: () => void
  disabled: boolean
  value: string | number
  inputLabel: string
  displayLabel: string
}

export function EditableHeaderField({
  className,
  label,
  editing,
  inputRef,
  draft,
  setDraft,
  commit,
  cancel,
  begin,
  disabled,
  value,
  inputLabel,
  displayLabel,
}: EditableHeaderFieldProps) {
  return (
    <div className={`headerField ${className}`}>
      <span className="fieldLabel">{label}</span>
      <div className="headerEditableValueSlot">
        {editing ? (
          <input
            ref={inputRef}
            className="headerEditableInput mono"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void commit(draft)
                return
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                cancel()
              }
            }}
            onBlur={cancel}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label={inputLabel}
          />
        ) : (
          <button
            type="button"
            className="headerEditableDisplay fieldValue mono"
            onClick={begin}
            disabled={disabled}
            aria-label={displayLabel}
          >
            {value}
          </button>
        )}
      </div>
    </div>
  )
}
