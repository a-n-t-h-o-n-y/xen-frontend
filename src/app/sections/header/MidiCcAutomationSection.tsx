import { useEffect, useMemo, useRef, useState } from 'react'

type MidiCcAutomationSectionProps = {
  controller: number
  labels: ReadonlyMap<number, string>
  usedControllers: ReadonlySet<number>
  valueSummary: string
  disabled: boolean
  onSelectController: (controller: number) => void
  onSetLabel: (controller: number, label: string) => Promise<void>
  onRemoveLabel: (controller: number) => Promise<void>
  onShift: (amount: number) => Promise<void>
  onRemoveValue: () => Promise<void>
}

const controllerName = (controller: number, labels: ReadonlyMap<number, string>): string => {
  const label = labels.get(controller)
  return label ? `CC ${controller} — ${label}` : `CC ${controller}`
}

export function MidiCcAutomationSection({
  controller,
  labels,
  usedControllers,
  valueSummary,
  disabled,
  onSelectController,
  onSetLabel,
  onRemoveLabel,
  onShift,
  onRemoveValue,
}: MidiCcAutomationSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(labels.get(controller) ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const closeOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [pickerOpen])

  useEffect(() => {
    if (editingLabel) window.requestAnimationFrame(() => labelRef.current?.select())
  }, [editingLabel])

  const options = useMemo(() => {
    const query = search.trim().toLowerCase()
    return Array.from({ length: 128 }, (_, value) => value)
      .filter((value) => {
        if (!query) return true
        return String(value).includes(query) ||
          (labels.get(value)?.toLowerCase().includes(query) ?? false)
      })
  }, [labels, search])

  const run = async (task: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const commitLabel = (): void => {
    const label = labelDraft.trim()
    void run(async () => {
      if (new TextEncoder().encode(label).byteLength > 4096) {
        throw new Error('MIDI CC labels must not exceed 4096 UTF-8 bytes.')
      }
      if (label) await onSetLabel(controller, label)
      else await onRemoveLabel(controller)
      setEditingLabel(false)
    })
  }

  return (
    <section
      ref={rootRef}
      className="headerControlGroup headerControlGroup-automation"
      aria-label="MIDI CC automation"
    >
      <h2 className="headerGroupLabel">Automation</h2>
      <div className="automationFields">
        <div className="automationControllerPicker">
          <span className="fieldLabel">Controller</span>
          <button
            type="button"
            className="automationControllerTrigger mono"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-label={`Select MIDI controller. Current ${controllerName(controller, labels)}`}
            disabled={disabled || busy}
            onClick={() => {
              setSearch('')
              setPickerOpen((open) => !open)
            }}
          >
            {controllerName(controller, labels)}
            <span aria-hidden="true">▾</span>
          </button>
          {pickerOpen ? (
            <div className="automationControllerMenu">
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setPickerOpen(false)
                }}
                placeholder="Number or label"
                aria-label="Search MIDI controllers"
              />
              <div role="listbox" aria-label="MIDI controllers">
                {options.map((value) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === controller}
                    className="automationControllerOption"
                    key={value}
                    onClick={() => {
                      onSelectController(value)
                      setPickerOpen(false)
                    }}
                  >
                    <span>{controllerName(value, labels)}</span>
                    {usedControllers.has(value) ? <small>Used</small> : null}
                  </button>
                ))}
                {options.length === 0 ? <p>No matching controllers</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="automationLabelField">
          <span className="fieldLabel">Label</span>
          {editingLabel ? (
            <input
              ref={labelRef}
              className="automationLabelInput"
              value={labelDraft}
              maxLength={4096}
              aria-label={`Edit label for MIDI CC ${controller}`}
              onChange={(event) => setLabelDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitLabel()
                if (event.key === 'Escape') {
                  setLabelDraft(labels.get(controller) ?? '')
                  setEditingLabel(false)
                }
              }}
              onBlur={() => {
                setLabelDraft(labels.get(controller) ?? '')
                setEditingLabel(false)
              }}
            />
          ) : (
            <div className="automationLabelControl">
              <button
                type="button"
                className="automationLabelDisplay"
                disabled={disabled || busy}
                onClick={() => {
                  setLabelDraft(labels.get(controller) ?? '')
                  setEditingLabel(true)
                }}
                aria-label={`Label for MIDI CC ${controller}: ${labels.get(controller) ?? 'unlabeled'}. Click to edit`}
              >
                {labels.get(controller) ?? 'Add label'}
              </button>
              {labels.has(controller) ? (
                <button
                  type="button"
                  className="automationLabelClear"
                  disabled={disabled || busy}
                  aria-label={`Clear label for MIDI CC ${controller}`}
                  onClick={() => void run(() => onRemoveLabel(controller))}
                >
                  ×
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="automationValueField">
          <span className="fieldLabel">Selected</span>
          <span className="automationValue mono">{valueSummary}</span>
        </div>

        <div className="automationActions" aria-label="MIDI CC value actions">
          <button
            type="button"
            aria-label="Decrease by 8 MIDI steps"
            disabled={disabled || busy}
            onClick={() => void run(() => onShift(-8 / 127))}
          >−8</button>
          <button
            type="button"
            aria-label="Decrease by 1 MIDI step"
            disabled={disabled || busy}
            onClick={() => void run(() => onShift(-1 / 127))}
          >−1</button>
          <button
            type="button"
            aria-label="Increase by 1 MIDI step"
            disabled={disabled || busy}
            onClick={() => void run(() => onShift(1 / 127))}
          >+1</button>
          <button
            type="button"
            aria-label="Increase by 8 MIDI steps"
            disabled={disabled || busy}
            onClick={() => void run(() => onShift(8 / 127))}
          >+8</button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void run(onRemoveValue)}
          >Remove</button>
        </div>
        {error ? <span className="automationError" role="alert">{error}</span> : null}
      </div>
    </section>
  )
}
