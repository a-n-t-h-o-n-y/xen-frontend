import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { InputMode, TranslateDirection } from '../domain/models'
import type { SelectionInspectorModel } from '../presentation/viewModels'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { EditableHeaderField } from './header/EditableHeaderField'

type HeaderSectionProps = {
  isTimeSignatureEditing: boolean
  timeSignatureInputRef: { current: HTMLInputElement | null }
  timeSignatureDraft: string
  setTimeSignatureDraft: Dispatch<SetStateAction<string>>
  commitTimeSignature: (value: string) => Promise<unknown>
  cancelTimeSignatureEdit: () => void
  beginTimeSignatureEdit: () => void
  disabledReason: string | null
  metadataDisabledReason: string | null
  metadataAvailable: boolean
  timeSignature: string
  applyTimeSignatureScale: (mode: 'half' | 'double') => void
  isKeyEditing: boolean
  keyInputRef: { current: HTMLInputElement | null }
  keyDraft: string
  setKeyDraft: Dispatch<SetStateAction<string>>
  commitKey: (value: string) => Promise<unknown>
  cancelKeyEdit: () => void
  beginKeyEdit: () => void
  keyDisplay: string | number
  isBaseFrequencyEditing: boolean
  baseFrequencyInputRef: { current: HTMLInputElement | null }
  baseFrequencyDraft: string
  setBaseFrequencyDraft: Dispatch<SetStateAction<string>>
  commitBaseFrequency: (value: string) => Promise<unknown>
  cancelBaseFrequencyEdit: () => void
  beginBaseFrequencyEdit: () => void
  baseFrequency: string | number
  scaleMenuRef: { current: HTMLDivElement | null }
  openScaleMenu: boolean
  setOpenScaleMenu: Dispatch<SetStateAction<boolean>>
  isScaleUpdating: boolean
  scaleOptions: Array<{ id: string; name: string; command: string }>
  scaleName: string
  applyScaleSelection: (id: string) => Promise<void>
  scaleTranslateDirection: TranslateDirection | null
  toggleTranslateDirection: () => Promise<void>
  modeOptions: number[]
  scaleMode: number
  applyModeSelection: (modeIndex: number) => Promise<void>
  tuningName: string
  sequenceName: string
  currentInputMode: InputMode
  selectionInspector: SelectionInspectorModel
  showSelectionInspector: boolean
  onOpenQuickAccess: () => void
  onOpenSettings: () => void
  onEnterModulation: () => void
  modulationDisabled: boolean
}

function SelectionInspector({ model }: { model: SelectionInspectorModel }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (restoreFocus: boolean): void => {
      setOpen(false)
      if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  return (
    <div className="headerInspector" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="headerUtilityButton headerInspectorTrigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {model.summary}
      </button>
      {open ? (
        <section className="headerInspectorPopover" role="dialog" aria-label="Selection inspector">
          <div className="headerInspectorTitle">{model.summary}</div>
          {model.items.length > 0 ? (
            <dl className="headerInspectorList mono">
              {model.items.map((item) => (
                <div key={item.label} className="headerInspectorItem">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="headerInspectorEmpty">No metadata available.</p>}
        </section>
      ) : null}
    </div>
  )
}

export function HeaderSection({
  isTimeSignatureEditing,
  timeSignatureInputRef,
  timeSignatureDraft,
  setTimeSignatureDraft,
  commitTimeSignature,
  cancelTimeSignatureEdit,
  beginTimeSignatureEdit,
  disabledReason,
  metadataDisabledReason,
  metadataAvailable,
  timeSignature,
  applyTimeSignatureScale,
  isKeyEditing,
  keyInputRef,
  keyDraft,
  setKeyDraft,
  commitKey,
  cancelKeyEdit,
  beginKeyEdit,
  keyDisplay,
  isBaseFrequencyEditing,
  baseFrequencyInputRef,
  baseFrequencyDraft,
  setBaseFrequencyDraft,
  commitBaseFrequency,
  cancelBaseFrequencyEdit,
  beginBaseFrequencyEdit,
  baseFrequency,
  scaleMenuRef,
  openScaleMenu,
  setOpenScaleMenu,
  isScaleUpdating,
  scaleOptions,
  scaleName,
  applyScaleSelection,
  scaleTranslateDirection,
  toggleTranslateDirection,
  modeOptions,
  scaleMode,
  applyModeSelection,
  tuningName,
  sequenceName,
  currentInputMode,
  selectionInspector,
  showSelectionInspector,
  onOpenQuickAccess,
  onOpenSettings,
  onEnterModulation,
  modulationDisabled,
}: HeaderSectionProps) {
  return (
    <header className="header">
      <div className="headerIdentity">
        <span className="headerSequenceLabel">Sequence</span>
        <span className="headerSequenceName" title={sequenceName}>{sequenceName}</span>
        <span className="headerInputMode mono" aria-label={`Input mode ${currentInputMode}`}>
          {currentInputMode.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="headerField headerField-timeSignature">
        <span className="fieldLabel">Time</span>
        <div className="timeSignatureControl">
          <div className="timeSignatureValueSlot">
            {isTimeSignatureEditing && metadataAvailable ? (
              <input
                ref={timeSignatureInputRef}
                className="timeSignatureInput mono"
                type="text"
                value={timeSignatureDraft}
                onChange={(event) => setTimeSignatureDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commitTimeSignature(timeSignatureDraft)
                    return
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelTimeSignatureEdit()
                  }
                }}
                onBlur={cancelTimeSignatureEdit}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                aria-label="Edit time signature"
              />
            ) : (
              <button
                type="button"
                className="timeSignatureDisplay fieldValue mono"
                onClick={beginTimeSignatureEdit}
                disabled={metadataDisabledReason !== null}
                aria-label={`Time signature ${timeSignature}. Click to edit`}
              >
                {timeSignature}
              </button>
            )}
          </div>
          <div className="timeSignatureButtons" aria-label="Time signature quick actions">
            <button
              type="button"
              className="timeSignatureAction mono"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyTimeSignatureScale('half')}
              disabled={metadataDisabledReason !== null || isTimeSignatureEditing}
              aria-label="Halve time signature numerator"
            >
              /2
            </button>
            <button
              type="button"
              className="timeSignatureAction mono"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyTimeSignatureScale('double')}
              disabled={metadataDisabledReason !== null || isTimeSignatureEditing}
              aria-label="Double time signature numerator"
            >
              x2
            </button>
          </div>
        </div>
      </div>
      <EditableHeaderField
        className="headerField-key"
        label="Key"
        editing={isKeyEditing && metadataAvailable}
        inputRef={keyInputRef}
        draft={keyDraft}
        setDraft={setKeyDraft}
        commit={commitKey}
        cancel={cancelKeyEdit}
        begin={beginKeyEdit}
        disabled={metadataDisabledReason !== null}
        value={keyDisplay}
        inputLabel="Edit key"
        displayLabel={`Key ${keyDisplay}. Click to edit`}
      />
      <EditableHeaderField
        className="headerField-baseFrequency"
        label="Zero Hz"
        editing={isBaseFrequencyEditing && metadataAvailable}
        inputRef={baseFrequencyInputRef}
        draft={baseFrequencyDraft}
        setDraft={setBaseFrequencyDraft}
        commit={commitBaseFrequency}
        cancel={cancelBaseFrequencyEdit}
        begin={beginBaseFrequencyEdit}
        disabled={metadataDisabledReason !== null}
        value={baseFrequency}
        inputLabel="Edit base frequency"
        displayLabel={`Zero frequency ${baseFrequency} hertz. Click to edit`}
      />
      <div className="headerSpacer">
        <button
          type="button"
          className="headerQuickAccessTrigger"
          onClick={onOpenQuickAccess}
          disabled={disabledReason !== null}
          aria-label="Open quick access"
        >
          <span className="headerQuickAccessIcon" aria-hidden="true"><Icon name="search" size={15} /></span>
          <span className="headerQuickAccessLabel">
            Search files, tunings, scales, and commands
          </span>
        </button>
      </div>
      <div className="headerField headerField-scale">
        <span className="fieldLabel">Scale</span>
        <div className="headerScaleControl">
          <div className="waveSelect headerScaleSelect" ref={scaleMenuRef}>
            <button
              type="button"
              className="waveSelectTrigger headerScaleTrigger fieldValue"
              onClick={() => setOpenScaleMenu((previous) => !previous)}
              disabled={
                metadataDisabledReason !== null || isScaleUpdating || scaleOptions.length === 0
              }
              aria-haspopup="listbox"
              aria-expanded={openScaleMenu}
              aria-label="Select active scale"
            >
              <span className="headerScaleLabel">{scaleName}</span>
              <span className="waveSelectChevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {openScaleMenu && metadataAvailable ? (
              <div className="waveSelectMenu headerScaleMenu" role="listbox" aria-label="Scale options">
                {scaleOptions.map((option) => (
                  <button
                    key={`scale-option-${option.id}`}
                    type="button"
                    className={`waveSelectOption${option.name === scaleName ? ' waveSelectOption-active' : ''}`}
                    onClick={() => {
                      setOpenScaleMenu(false)
                      void applyScaleSelection(option.id)
                    }}
                    role="option"
                    aria-selected={option.name === scaleName}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="scaleDirectionGlyph mono"
            onClick={() => {
              void toggleTranslateDirection()
            }}
            disabled={metadataDisabledReason !== null}
            aria-label={scaleTranslateDirection === null
              ? 'Translate direction unavailable'
              : `Translate direction ${scaleTranslateDirection}. Click to set ${
                scaleTranslateDirection === 'down' ? 'up' : 'down'
              }`}
            title={scaleTranslateDirection === null
              ? 'Translate direction unavailable'
              : `Translate ${scaleTranslateDirection} (click to flip)`}
          >
            {scaleTranslateDirection === null
              ? '--'
              : scaleTranslateDirection === 'down' ? '↓' : '↑'}
          </button>
        </div>
      </div>
      <div className="headerField headerField-mode">
        <span className="fieldLabel">Mode</span>
        <div className="modePicker" role="listbox" aria-label="Scale modes">
          {modeOptions.length > 0 ? (
            modeOptions.map((modeIndex) => (
              <button
                key={`mode-option-${modeIndex}`}
                type="button"
                className={`modeChip mono${modeIndex === scaleMode ? ' modeChip-active' : ''}`}
                onClick={() => {
                  void applyModeSelection(modeIndex)
                }}
                disabled={metadataDisabledReason !== null}
                role="option"
                aria-selected={modeIndex === scaleMode}
                aria-label={`Set mode ${modeIndex}`}
              >
                {modeIndex}
              </button>
            ))
          ) : (
            <span className="modePickerEmpty mono">{metadataAvailable ? 'n/a' : '--'}</span>
          )}
        </div>
      </div>
      <div className="headerField headerField-tuning">
        <span className="fieldLabel">Tuning</span>
        <span className="fieldValue mono">{tuningName}</span>
      </div>
      <div className="headerActions">
        {showSelectionInspector ? <SelectionInspector model={selectionInspector} /> : null}
        <button
          type="button"
          className="headerUtilityButton headerModulationButton"
          onClick={onEnterModulation}
          disabled={modulationDisabled}
        >
          Modulate
        </button>
        <IconButton
          className="headerSettingsButton"
          onClick={onOpenSettings}
          label="Open settings"
          title="Settings"
        >
          <Icon name="settings" size={15} />
        </IconButton>
      </div>
    </header>
  )
}
