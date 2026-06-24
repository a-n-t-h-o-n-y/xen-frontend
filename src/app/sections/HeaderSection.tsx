import type { Dispatch, SetStateAction } from 'react'
import type { TranslateDirection } from '../shared'

type HeaderSectionProps = {
  isTimeSignatureEditing: boolean
  timeSignatureInputRef: { current: HTMLInputElement | null }
  timeSignatureDraft: string
  setTimeSignatureDraft: Dispatch<SetStateAction<string>>
  commitTimeSignature: (value: string) => Promise<unknown>
  cancelTimeSignatureEdit: () => void
  beginTimeSignatureEdit: () => void
  disabledReason: string | null
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
  scaleTranslateDirection: TranslateDirection
  toggleTranslateDirection: () => Promise<void>
  modeOptions: number[]
  scaleMode: number
  applyModeSelection: (modeIndex: number) => Promise<void>
  tuningName: string
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
}: HeaderSectionProps) {
  return (
    <header className="header">
      <div className="headerField headerField-timeSignature">
        <span className="fieldLabel">Time</span>
        <div className="timeSignatureControl">
          <div className="timeSignatureValueSlot">
            {isTimeSignatureEditing ? (
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
                disabled={disabledReason !== null}
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
              disabled={disabledReason !== null || isTimeSignatureEditing}
              aria-label="Halve time signature numerator"
            >
              /2
            </button>
            <button
              type="button"
              className="timeSignatureAction mono"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyTimeSignatureScale('double')}
              disabled={disabledReason !== null || isTimeSignatureEditing}
              aria-label="Double time signature numerator"
            >
              x2
            </button>
          </div>
        </div>
      </div>
      <div className="headerField headerField-key">
        <span className="fieldLabel">Key</span>
        <div className="headerEditableValueSlot">
          {isKeyEditing ? (
            <input
              ref={keyInputRef}
              className="headerEditableInput mono"
              type="text"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitKey(keyDraft)
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelKeyEdit()
                }
              }}
              onBlur={cancelKeyEdit}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Edit key"
            />
          ) : (
            <button
              type="button"
              className="headerEditableDisplay fieldValue mono"
              onClick={beginKeyEdit}
              disabled={disabledReason !== null}
              aria-label={`Key ${keyDisplay}. Click to edit`}
            >
              {keyDisplay}
            </button>
          )}
        </div>
      </div>
      <div className="headerField headerField-baseFrequency">
        <span className="fieldLabel">Zero Hz</span>
        <div className="headerEditableValueSlot">
          {isBaseFrequencyEditing ? (
            <input
              ref={baseFrequencyInputRef}
              className="headerEditableInput mono"
              type="text"
              value={baseFrequencyDraft}
              onChange={(event) => setBaseFrequencyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitBaseFrequency(baseFrequencyDraft)
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelBaseFrequencyEdit()
                }
              }}
              onBlur={cancelBaseFrequencyEdit}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Edit base frequency"
            />
          ) : (
            <button
              type="button"
              className="headerEditableDisplay fieldValue mono"
              onClick={beginBaseFrequencyEdit}
              disabled={disabledReason !== null}
              aria-label={`Zero frequency ${baseFrequency} hertz. Click to edit`}
            >
              {baseFrequency}
            </button>
          )}
        </div>
      </div>
      <div className="headerSpacer" aria-hidden="true">
        <span className="headerAppName">XenSequencer</span>
      </div>
      <div className="headerField headerField-scale">
        <span className="fieldLabel">Scale</span>
        <div className="headerScaleControl">
          <div className="waveSelect headerScaleSelect" ref={scaleMenuRef}>
            <button
              type="button"
              className="waveSelectTrigger headerScaleTrigger fieldValue"
              onClick={() => setOpenScaleMenu((previous) => !previous)}
              disabled={disabledReason !== null || isScaleUpdating || scaleOptions.length === 0}
              aria-haspopup="listbox"
              aria-expanded={openScaleMenu}
              aria-label="Select active scale"
            >
              <span className="headerScaleLabel">{scaleName}</span>
              <span className="waveSelectChevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {openScaleMenu ? (
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
            disabled={disabledReason !== null}
            aria-label={`Translate direction ${scaleTranslateDirection}. Click to set ${
              scaleTranslateDirection === 'down' ? 'up' : 'down'
            }`}
            title={`Translate ${scaleTranslateDirection} (click to flip)`}
          >
            {scaleTranslateDirection === 'down' ? '↓' : '↑'}
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
                disabled={disabledReason !== null}
                role="option"
                aria-selected={modeIndex === scaleMode}
                aria-label={`Set mode ${modeIndex}`}
              >
                {modeIndex}
              </button>
            ))
          ) : (
            <span className="modePickerEmpty mono">n/a</span>
          )}
        </div>
      </div>
      <div className="headerField headerField-tuning">
        <span className="fieldLabel">Tuning</span>
        <span className="fieldValue mono">{tuningName}</span>
      </div>
    </header>
  )
}
