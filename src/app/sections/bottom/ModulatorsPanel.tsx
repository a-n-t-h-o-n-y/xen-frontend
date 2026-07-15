import { useEffect, useRef } from 'react'
import { ListboxPicker } from '../../ui/ListboxPicker'
import {
  MODULATION_DESTINATION_LABELS,
  MODULATION_OPERATION_LABELS,
  MODULATION_SHAPE_LABELS,
  createEditorWaveform,
  getSelectedWaveform,
  operationAcceptsEnabledCount,
} from '../../domain/modulation'
import type { ChangeEvent } from 'react'
import type {
  ModulationCatalog,
  ModulationDestination,
  ModulationEditorState,
  ModulationOperation,
  ModulationShape,
} from '../../domain/modulation'

type StateUpdater = (current: ModulationEditorState) => ModulationEditorState

type ModulatorsPanelProps = {
  catalog: ModulationCatalog
  destination: ModulationDestination
  state: ModulationEditorState
  busy: boolean
  waveformManagerOpen: boolean
  setWaveformManagerOpen: (open: boolean) => void
  setDestination: (destination: ModulationDestination) => void
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

export function ModulatorsPanel({
  catalog,
  destination,
  state,
  busy,
  waveformManagerOpen,
  setWaveformManagerOpen,
  setDestination,
  updateLocalState,
  applyAtomicState,
  beginContinuousEdit,
  updateContinuousState,
  commitContinuousEdit,
  cancelContinuousEdit,
}: ModulatorsPanelProps) {
  const managerRef = useRef<HTMLDivElement>(null)
  const selected = getSelectedWaveform(state)
  const enabledCount = state.waveforms.filter((waveform) => waveform.enabled).length
  const operation = catalog.operations.find((entry) => entry.id === state.operation)

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

  const destinationOptions = catalog.destinations.map((entry) => ({
    id: entry.id,
    name: MODULATION_DESTINATION_LABELS[entry.id],
  }))
  const shapeOptions = catalog.waveform_shapes.map((shape) => ({
    id: shape,
    name: MODULATION_SHAPE_LABELS[shape],
  }))
  const validOperations = catalog.operations.filter((entry) =>
    operationAcceptsEnabledCount(catalog, entry.id, enabledCount)
  )
  const range = state.outputRanges[destination]

  return (
    <>
      <section className="headerControlGroup modulationControlGroup" aria-label="Destination">
        <h2 className="headerGroupLabel">Target</h2>
        <div className="modulationDestinationControls">
          <label className="modulationField">
            <span className="fieldLabel">Destination</span>
            <ListboxPicker
              options={destinationOptions}
              selectedId={destination}
              selectedName={MODULATION_DESTINATION_LABELS[destination]}
              triggerLabel="Modulation destination"
              listLabel="Modulation destinations"
              disabled={busy}
              onSelect={(id) => setDestination(id as ModulationDestination)}
            />
          </label>
          {(['minimum', 'maximum'] as const).map((endpoint) => (
            <label className="modulationField" key={endpoint}>
              <span className="fieldLabel">{endpoint === 'minimum' ? 'Minimum' : 'Maximum'}</span>
              <input
                className="modulationNumber mono"
                type="number"
                step={destination === 'pitch' ? 1 : 0.01}
                value={range[endpoint]}
                disabled={busy}
                onFocus={beginContinuousEdit}
                onChange={(event) => updateNumber((value) => (current) => ({
                  ...current,
                  outputRanges: {
                    ...current.outputRanges,
                    [destination]: { ...current.outputRanges[destination], [endpoint]: value },
                  },
                }), event)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitContinuousEdit()
                  if (event.key === 'Escape') cancelContinuousEdit()
                }}
                onBlur={commitContinuousEdit}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="headerControlGroup modulationControlGroup" aria-label="Waveforms">
        <h2 className="headerGroupLabel">Waves</h2>
        <div className="modulationWaveControls" ref={managerRef}>
          <label className="modulationField modulationWaveManagerField">
            <span className="fieldLabel">Waveforms</span>
            <button
              type="button"
              className="modulationManagerTrigger"
              aria-haspopup="dialog"
              aria-expanded={waveformManagerOpen}
              onClick={() => setWaveformManagerOpen(!waveformManagerOpen)}
            >
              <span aria-hidden="true">∿</span>
              <span>{enabledCount}/{state.waveforms.length} enabled</span>
            </button>
          </label>
          <label className="modulationField">
            <span className="fieldLabel">Combine</span>
            <select
              className="modulationSelect"
              value={state.operation}
              disabled={busy}
              onChange={(event) => applyAtomicState((current) => ({
                ...current,
                operation: event.target.value as ModulationOperation,
              }))}
            >
              {validOperations.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {MODULATION_OPERATION_LABELS[entry.id]}
                </option>
              ))}
            </select>
          </label>
          {waveformManagerOpen ? (
            <div className="modulationWaveManager" role="dialog" aria-label="Waveform manager">
              <div className="modulationWaveManagerHeader">
                <div>
                  <strong>Waveforms</strong>
                  <span>{state.waveforms.length} of {catalog.maximum_waveforms}</span>
                </div>
                <button
                  type="button"
                  className="modulationAddWave"
                  disabled={busy || state.waveforms.length >= catalog.maximum_waveforms}
                  onClick={() => applyAtomicState((current) => {
                    const fixedTwo = operation?.enabled_waveforms === 2 ||
                      ['am', 'ring', 'fm', 'pm'].includes(state.operation)
                    const waveform = createEditorWaveform(
                      catalog.waveform_shapes[0] ?? 'sine',
                      !fixedTwo
                    )
                    return {
                      ...current,
                      waveforms: [...current.waveforms, waveform],
                      selectedWaveformId: waveform.id,
                    }
                  })}
                >
                  + Add waveform
                </button>
              </div>
              <div className="modulationWaveRows">
                {state.waveforms.map((waveform) => {
                  const enabledIndex = state.waveforms.filter((entry) => entry.enabled)
                    .findIndex((entry) => entry.id === waveform.id)
                  const role = operation?.roles?.[enabledIndex] ?? (
                    operation?.enabled_waveforms === 2 ||
                    ['am', 'ring', 'fm', 'pm'].includes(state.operation)
                      ? enabledIndex === 0 ? 'carrier' : enabledIndex === 1 ? 'modulator' : undefined
                      : undefined
                  )
                  const nextEnabledCount = enabledCount + (waveform.enabled ? -1 : 1)
                  const canToggle = operationAcceptsEnabledCount(
                    catalog,
                    state.operation,
                    nextEnabledCount
                  )
                  const countAfterRemoval = enabledCount - (waveform.enabled ? 1 : 0)
                  const canRemove = state.waveforms.length > 1 && operationAcceptsEnabledCount(
                    catalog,
                    state.operation,
                    countAfterRemoval
                  )
                  return (
                    <div
                      className={`modulationWaveRow${waveform.id === selected.id ? ' modulationWaveRow-selected' : ''}`}
                      key={waveform.id}
                    >
                      <button
                        type="button"
                        className="modulationWaveSelect"
                        aria-label={`Select waveform ${state.waveforms.indexOf(waveform) + 1}`}
                        aria-pressed={waveform.id === selected.id}
                        onClick={() => updateLocalState((current) => ({
                          ...current,
                          selectedWaveformId: waveform.id,
                        }))}
                      >
                        <span aria-hidden="true">∿</span>
                      </button>
                      <input
                        type="checkbox"
                        aria-label={`Enable waveform ${state.waveforms.indexOf(waveform) + 1}`}
                        checked={waveform.enabled}
                        disabled={busy || !canToggle}
                        onChange={() => applyAtomicState((current) => ({
                          ...current,
                          waveforms: current.waveforms.map((entry) => entry.id === waveform.id
                            ? { ...entry, enabled: !entry.enabled }
                            : entry),
                        }))}
                      />
                      <ListboxPicker
                        options={shapeOptions}
                        selectedId={waveform.shape}
                        selectedName={MODULATION_SHAPE_LABELS[waveform.shape]}
                        triggerLabel={`Waveform ${state.waveforms.indexOf(waveform) + 1} shape`}
                        listLabel="Waveform shapes"
                        disabled={busy}
                        onSelect={(id) => applyAtomicState((current) => ({
                          ...current,
                          waveforms: current.waveforms.map((entry) => entry.id === waveform.id
                            ? { ...entry, shape: id as ModulationShape }
                            : entry),
                        }))}
                      />
                      <span className="modulationWaveRole">{role ?? ''}</span>
                      <button
                        type="button"
                        className="modulationRemoveWave"
                        aria-label={`Remove waveform ${state.waveforms.indexOf(waveform) + 1}`}
                        disabled={busy || !canRemove}
                        onClick={() => applyAtomicState((current) => {
                          const index = current.waveforms.findIndex((entry) => entry.id === waveform.id)
                          const waveforms = current.waveforms.filter((entry) => entry.id !== waveform.id)
                          const nextSelected = waveform.id === current.selectedWaveformId
                            ? waveforms[Math.min(index, waveforms.length - 1)]?.id ?? waveforms[0]?.id
                            : current.selectedWaveformId
                          return { ...current, waveforms, selectedWaveformId: nextSelected ?? '' }
                        })}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="headerControlGroup modulationControlGroup" aria-label="Selected waveform">
        <h2 className="headerGroupLabel">Edit</h2>
        <div className="modulationParameterControls">
          <div className="modulationField">
            <span className="fieldLabel">Selected</span>
            <button
              type="button"
              className="modulationSelectedShape"
              onClick={() => setWaveformManagerOpen(true)}
            >
              <span aria-hidden="true">∿</span>
              <span>{MODULATION_SHAPE_LABELS[selected.shape]}</span>
            </button>
          </div>
          {([
            ['frequency', 'Frequency'],
            ['phase', 'Phase'],
            ['amplitude', 'Amplitude'],
            ['amplitude_offset', 'Offset'],
          ] as const).map(([parameter, label]) => {
            const bounds = catalog.waveform_parameters[parameter]
            return (
              <label className="modulationField" key={parameter}>
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
