import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { InputMode, TranslateDirection } from '../domain/models'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { EditableHeaderField } from './header/EditableHeaderField'
import { ModeStepper } from './header/ModeStepper'
import { ScalePicker } from './header/ScalePicker'

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
  isScaleUpdating: boolean
  scaleOptions: Array<{ id: string; name: string; command: string }>
  scaleName: string
  scaleSourceId: string | null
  applyScaleSelection: (id: string) => Promise<void>
  scaleTranslateDirection: TranslateDirection | null
  toggleTranslateDirection: () => Promise<void>
  modeOptions: number[]
  scaleMode: number
  applyModeSelection: (modeIndex: number) => Promise<void>
  tuningName: string
  sequenceName: string
  currentInputMode: InputMode
  documentControls: ReactNode
  onOpenQuickAccess: () => void
  onOpenSettings: () => void
  onEnterModulation: () => void
  onExitModulation: () => void
  modulationDisabled: boolean
  modulationControls?: ReactNode
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
  isScaleUpdating,
  scaleOptions,
  scaleName,
  scaleSourceId,
  applyScaleSelection,
  scaleTranslateDirection,
  toggleTranslateDirection,
  modeOptions,
  scaleMode,
  applyModeSelection,
  tuningName,
  sequenceName,
  currentInputMode,
  documentControls,
  onOpenQuickAccess,
  onOpenSettings,
  onEnterModulation,
  onExitModulation,
  modulationDisabled,
  modulationControls,
}: HeaderSectionProps) {
  return (
    <header className={`header${modulationControls ? ' header-modulation' : ''}`}>
      <div className="headerPrimaryRow">
        <div className="headerIdentity">
          <span className="headerSequenceLabel">Sequence</span>
          <span className="headerSequenceName" title={sequenceName}>{sequenceName}</span>
        </div>
        <div className="headerPalette">
          <button
            type="button"
            className="headerQuickAccessTrigger"
            onClick={onOpenQuickAccess}
            disabled={disabledReason !== null}
            aria-label="Open quick access"
          >
            <span className="headerQuickAccessIcon" aria-hidden="true">
              <Icon name="search" size={15} />
            </span>
            <span className="headerQuickAccessLabel">
              Search files, tunings, scales, and commands
            </span>
          </button>
        </div>
        <div className="headerActions">
          {documentControls}
          <div className="headerInputStatus" aria-label={`Input mode ${currentInputMode}`}>
            <span className="headerInputStatusLabel">Input</span>
            <span className="headerInputStatusValue">
              {currentInputMode.charAt(0).toUpperCase() + currentInputMode.slice(1)}
            </span>
          </div>
          <button
            type="button"
            className={`headerUtilityButton headerModulationButton${
              modulationControls ? ' headerModulationButton-active' : ''
            }`}
            onClick={modulationControls ? onExitModulation : onEnterModulation}
            disabled={!modulationControls && modulationDisabled}
            aria-pressed={modulationControls !== undefined}
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
      </div>
      {modulationControls ?? (
        <div className="headerControlRow">
        <section className="headerControlGroup headerControlGroup-time" aria-label="Timing">
          <h2 className="headerGroupLabel">Timing</h2>
          <div className="headerGroupFields">
            <div className="headerField headerField-timeSignature">
              <span className="fieldLabel">Duration</span>
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
                      aria-label="Edit duration"
                    />
                  ) : (
                    <button
                      type="button"
                      className="timeSignatureDisplay fieldValue mono"
                      onClick={beginTimeSignatureEdit}
                      disabled={metadataDisabledReason !== null}
                      aria-label={`Duration ${timeSignature}. Click to edit`}
                    >
                      {timeSignature}
                    </button>
                  )}
                </div>
                <div className="timeSignatureButtons" aria-label="Duration quick actions">
                  <button
                    type="button"
                    className="timeSignatureAction mono"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyTimeSignatureScale('half')}
                    disabled={metadataDisabledReason !== null || isTimeSignatureEditing}
                    aria-label="Halve duration numerator"
                  >
                    /2
                  </button>
                  <button
                    type="button"
                    className="timeSignatureAction mono"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyTimeSignatureScale('double')}
                    disabled={metadataDisabledReason !== null || isTimeSignatureEditing}
                    aria-label="Double duration numerator"
                  >
                    ×2
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="headerControlGroup headerControlGroup-pitch" aria-label="Pitch system">
          <h2 className="headerGroupLabel">Pitch</h2>
          <div className="headerGroupFields">
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
            <div className="headerField headerField-scale">
              <span className="fieldLabel">Scale</span>
              <div className="headerScaleControl">
                <ScalePicker
                  options={scaleOptions}
                  selectedId={metadataAvailable ? scaleSourceId : null}
                  selectedName={metadataAvailable ? scaleName : '--'}
                  disabled={
                    metadataDisabledReason !== null ||
                    isScaleUpdating ||
                    scaleOptions.length === 0
                  }
                  onSelect={applyScaleSelection}
                />
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
              <ModeStepper
                options={modeOptions}
                value={scaleMode}
                placeholder={metadataAvailable ? 'n/a' : '--'}
                disabled={metadataDisabledReason !== null || modeOptions.length === 0}
                onChange={applyModeSelection}
              />
            </div>
          </div>
        </section>
        <section className="headerControlGroup headerControlGroup-tuning" aria-label="Tuning">
          <h2 className="headerGroupLabel">Tuning</h2>
          <div className="headerGroupFields">
            <EditableHeaderField
              className="headerField-reference"
              label="Reference"
              editing={isBaseFrequencyEditing && metadataAvailable}
              inputRef={baseFrequencyInputRef}
              draft={baseFrequencyDraft}
              setDraft={setBaseFrequencyDraft}
              commit={commitBaseFrequency}
              cancel={cancelBaseFrequencyEdit}
              begin={beginBaseFrequencyEdit}
              disabled={metadataDisabledReason !== null}
              value={baseFrequency}
              suffix="Hz"
              inputLabel="Edit reference frequency for pitch 0"
              displayLabel={
                `Reference frequency for pitch 0 ${baseFrequency} hertz. Click to edit`
              }
            />
            <div className="headerField headerField-tuningName">
              <span className="fieldLabel">Tuning</span>
              <span className="headerReadOnlyValue fieldValue mono">{tuningName}</span>
            </div>
          </div>
        </section>
        </div>
      )}
    </header>
  )
}
