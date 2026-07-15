import { useEffect, useRef } from 'react'
import { ListboxPicker } from '../../ui/ListboxPicker'
import {
  MODULATION_OPERATION_LABELS,
  MODULATION_SHAPE_LABELS,
  createEditorWaveform,
  getSelectedWaveform,
  isBinaryOperation,
  normalizeWaveformsForOperation,
} from '../../domain/modulation'
import type { ChangeEvent } from 'react'
import type {
  ModulationCatalog,
  ModulationEditorState,
  ModulationOperation,
  ModulationShape,
} from '../../domain/modulation'

type StateUpdater = (current: ModulationEditorState) => ModulationEditorState

type ModulatorsPanelProps = {
  catalog: ModulationCatalog
  state: ModulationEditorState
  busy: boolean
  waveformManagerOpen: boolean
  setWaveformManagerOpen: (open: boolean) => void
  updateLocalState: (update: StateUpdater) => void
  applyAtomicState: (update: StateUpdater) => void
  beginContinuousEdit: () => boolean
  updateContinuousState: (update: StateUpdater) => void
  commitContinuousEdit: () => void
  cancelContinuousEdit: () => void
}

const formatValue = (value: number): string => Number.isInteger(value)
  ? value.toFixed(0)
  : value.toFixed(2)

function WaveformIcon({ shape }: { shape: ModulationShape }) {
  const pathByShape: Record<ModulationShape, string> = {
    sine: 'M2 12 C6 3 10 3 14 12 S22 21 26 12',
    triangle: 'M2 17 L8 7 L14 17 L20 7 L26 17',
    sawtooth_up: 'M2 18 L14 6 L14 18 L26 6',
    sawtooth_down: 'M2 6 L2 18 L14 6 L14 18 L26 6',
    square: 'M2 17 L2 7 L14 7 L14 17 L26 17 L26 7',
  }
  return (
    <svg className="modulationWaveIcon" viewBox="0 0 28 24" aria-hidden="true">
      <path d={pathByShape[shape]} />
    </svg>
  )
}

export function ModulatorsPanel({
  catalog,
  state,
  busy,
  waveformManagerOpen,
  setWaveformManagerOpen,
  updateLocalState,
  applyAtomicState,
  beginContinuousEdit,
  updateContinuousState,
  commitContinuousEdit,
  cancelContinuousEdit,
}: ModulatorsPanelProps) {
  const managerRef = useRef<HTMLDivElement>(null)
  const selected = getSelectedWaveform(state)
  const selectedIndex = state.waveforms.findIndex((waveform) => waveform.id === selected.id)
  const enabledCount = state.waveforms.filter((waveform) => waveform.enabled).length
  const binary = isBinaryOperation(catalog, state.operation)

  useEffect(() => {
    if (!waveformManagerOpen) return
    const closeOutside = (event: PointerEvent): void => {
      if (!managerRef.current?.contains(event.target as Node)) setWaveformManagerOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [setWaveformManagerOpen, waveformManagerOpen])

  const updateNumber = (
    createUpdate: (value: number) => StateUpdater,
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    const value = Number(event.target.value)
    if (Number.isFinite(value)) updateContinuousState(createUpdate(value))
  }

  const selectWaveform = (id: string): void => updateLocalState((current) => ({
    ...current,
    selectedWaveformId: id,
  }))

  const openWaveformMenu = (id: string): void => {
    selectWaveform(id)
    setWaveformManagerOpen(true)
  }

  const operationOptions = catalog.operations.map((entry) => ({
    id: entry.id,
    name: MODULATION_OPERATION_LABELS[entry.id],
  }))

  return (
    <>
      <section className="headerControlGroup modulationControlGroup" aria-label="Waveforms">
        <h2 className="headerGroupLabel">Waves</h2>
        <div className="modulationWaveControls" ref={managerRef}>
          <div className="modulationWaveStrip" aria-label="Waveforms">
            {state.waveforms.map((waveform, index) => (
              <div
                className={[
                  'modulationWaveTile',
                  waveform.id === selected.id ? 'modulationWaveTile-selected' : '',
                  waveform.enabled ? '' : 'modulationWaveTile-disabled',
                ].filter(Boolean).join(' ')}
                key={waveform.id}
              >
                <button
                  type="button"
                  className="modulationWaveTileSelect"
                  aria-label={`Select waveform ${index + 1}`}
                  aria-pressed={waveform.id === selected.id}
                  onClick={() => selectWaveform(waveform.id)}
                >
                  <WaveformIcon shape={waveform.shape} />
                </button>
                <button
                  type="button"
                  className="modulationWaveTileMenu"
                  aria-label={`Configure waveform ${index + 1}`}
                  aria-expanded={waveformManagerOpen && waveform.id === selected.id}
                  onClick={() => openWaveformMenu(waveform.id)}
                >
                  ▾
                </button>
              </div>
            ))}
            <button
              type="button"
              className="modulationWaveAddTile"
              aria-label="Add waveform"
              disabled={busy || state.waveforms.length >= catalog.maximum_waveforms}
              onClick={() => applyAtomicState((current) => {
                const operationIsBinary = isBinaryOperation(catalog, current.operation)
                const waveform = createEditorWaveform(
                  catalog.waveform_shapes[0] ?? 'sine',
                  !operationIsBinary
                )
                return {
                  ...current,
                  waveforms: [...current.waveforms, waveform],
                  selectedWaveformId: waveform.id,
                }
              })}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>

          <label className="modulationField modulationCombineField">
            <span className="fieldLabel">Combine</span>
            <ListboxPicker
              options={operationOptions}
              selectedId={state.operation}
              selectedName={MODULATION_OPERATION_LABELS[state.operation]}
              triggerLabel="Combine waveforms"
              listLabel="Waveform combination operations"
              disabled={busy}
              onSelect={(id) => applyAtomicState((current) => {
                const operation = id as ModulationOperation
                return {
                  ...current,
                  operation,
                  waveforms: normalizeWaveformsForOperation(
                    catalog,
                    operation,
                    current.waveforms
                  ),
                }
              })}
            />
          </label>

          {waveformManagerOpen ? (
            <div className="modulationWaveManager" role="dialog" aria-label={`Waveform ${selectedIndex + 1} settings`}>
              <div className="modulationWaveManagerHeader">
                <div>
                  <strong>Waveform {selectedIndex + 1}</strong>
                  <span>{binary && selectedIndex < 2
                    ? selectedIndex === 0 ? 'Carrier' : 'Modulator'
                    : selected.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <button
                  type="button"
                  className="modulationRemoveWave"
                  aria-label={`Remove waveform ${selectedIndex + 1}`}
                  disabled={busy || state.waveforms.length <= (binary ? 2 : 1) || (
                    !binary && selected.enabled && enabledCount <= 1
                  )}
                  onClick={() => {
                    applyAtomicState((current) => {
                      const index = current.waveforms.findIndex((waveform) =>
                        waveform.id === current.selectedWaveformId)
                      const remaining = current.waveforms.filter((waveform) =>
                        waveform.id !== current.selectedWaveformId)
                      const waveforms = normalizeWaveformsForOperation(
                        catalog,
                        current.operation,
                        remaining
                      )
                      return {
                        ...current,
                        waveforms,
                        selectedWaveformId: waveforms[Math.min(index, waveforms.length - 1)]?.id
                          ?? waveforms[0]?.id
                          ?? '',
                      }
                    })
                    setWaveformManagerOpen(false)
                  }}
                >
                  Remove
                </button>
              </div>

              <label className="modulationEnableWave">
                <input
                  type="checkbox"
                  checked={selected.enabled}
                  disabled={busy || binary || (selected.enabled && enabledCount <= 1)}
                  onChange={(event) => applyAtomicState((current) => ({
                    ...current,
                    waveforms: current.waveforms.map((waveform) =>
                      waveform.id === current.selectedWaveformId
                        ? { ...waveform, enabled: event.target.checked }
                        : waveform),
                  }))}
                />
                <span>{binary ? 'Fixed by binary operation' : 'Enabled'}</span>
              </label>

              <div className="modulationShapeGrid" aria-label="Wave shape">
                {catalog.waveform_shapes.map((shape) => (
                  <button
                    type="button"
                    className={`modulationShapeOption${selected.shape === shape ? ' modulationShapeOption-selected' : ''}`}
                    aria-label={MODULATION_SHAPE_LABELS[shape]}
                    aria-pressed={selected.shape === shape}
                    key={shape}
                    disabled={busy}
                    onClick={() => {
                      applyAtomicState((current) => ({
                        ...current,
                        waveforms: current.waveforms.map((waveform) =>
                          waveform.id === current.selectedWaveformId
                            ? { ...waveform, shape }
                            : waveform),
                      }))
                      setWaveformManagerOpen(false)
                    }}
                  >
                    <WaveformIcon shape={shape} />
                    <span>{MODULATION_SHAPE_LABELS[shape]}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="headerControlGroup modulationControlGroup" aria-label="Selected waveform">
        <h2 className="headerGroupLabel">Edit</h2>
        <div className="modulationParameterControls">
          {([
            ['frequency', 'Frequency'],
            ['phase', 'Phase'],
            ['amplitude', 'Amplitude'],
            ['amplitude_offset', 'Offset'],
          ] as const).map(([parameter, label]) => {
            const bounds = catalog.waveform_parameters[parameter]
            return (
              <label className="modulationField modulationCompactField" key={parameter}>
                <span className="fieldLabel">{label}</span>
                <input
                  className="modulationNumber mono"
                  type="number"
                  min={bounds.minimum}
                  max={bounds.maximum}
                  step={0.01}
                  value={formatValue(selected[parameter])}
                  disabled={busy}
                  onFocus={beginContinuousEdit}
                  onChange={(event) => updateNumber((value) => (current) => ({
                    ...current,
                    waveforms: current.waveforms.map((waveform) =>
                      waveform.id === current.selectedWaveformId
                        ? { ...waveform, [parameter]: Math.max(bounds.minimum, Math.min(value, bounds.maximum)) }
                        : waveform),
                  }), event)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitContinuousEdit()
                    if (event.key === 'Escape') cancelContinuousEdit()
                  }}
                  onBlur={commitContinuousEdit}
                />
              </label>
            )
          })}
        </div>
      </section>
    </>
  )
}
