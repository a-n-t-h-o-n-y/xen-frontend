import type { Dispatch, SetStateAction } from 'react'
import {
  MOD_TARGET_ORDER,
  getModTargetSpecForTuning,
  WAVE_OPTIONS,
  WAVE_OPTION_LABELS,
  type ModTarget,
  type Modulator,
  type TargetControl,
  type WaveType,
} from '../../shared'

type WavePadDragState = {
  pointerId: number
  wave: 'a' | 'b'
  host: HTMLDivElement
  startClientX: number
  startClientY: number
  moved: boolean
}

type PadDragState = {
  pointerId: number
  target: ModTarget
  mode: 'amount' | 'center'
  host: HTMLDivElement
  startClientX: number
  startClientY: number
  startAmount: number
  startCenter: number
}

type ModulatorsPanelProps = {
  activeModulatorTab: number
  setOpenWaveMenu: Dispatch<SetStateAction<'a' | 'b' | null>>
  setActiveModulatorTab: Dispatch<SetStateAction<number>>
  waveMenuRef: { current: HTMLDivElement | null }
  openWaveMenu: 'a' | 'b' | null
  waveAType: WaveType
  waveBType: WaveType
  selectWaveType: (wave: 'a' | 'b', waveType: WaveType) => void
  waveLerp: number
  onWaveLerpChange: (value: number) => void
  waveAPulseWidth: number
  setWaveAPulseWidth: Dispatch<SetStateAction<number>>
  waveBPulseWidth: number
  setWaveBPulseWidth: Dispatch<SetStateAction<number>>
  wavePadDragRef: { current: WavePadDragState | null }
  clampNumber: (value: number, min: number, max: number) => number
  waveHandleA: { x: number; y: number }
  waveHandleB: { x: number; y: number }
  lastWaveHandleUsedRef: { current: 'a' | 'b' }
  snapWaveToCenterGuides: (
    wave: 'a' | 'b',
    options: { snapFrequency: boolean; snapOffset: boolean }
  ) => void
  applyWavePadMotion: (
    wave: 'a' | 'b',
    host: HTMLDivElement,
    clientX: number,
    clientY: number,
    lockMode: 'frequency' | 'offset' | 'none'
  ) => void
  waveAOpacity: number
  waveBOpacity: number
  waveAPreviewPath: string
  waveBPreviewPath: string
  morphedWavePreviewPath: string
  targetControls: Record<ModTarget, TargetControl>
  updateTargetControl: (target: ModTarget, patch: Partial<TargetControl>) => void
  padDragRef: { current: PadDragState | null }
  applyPadMotion: (
    target: ModTarget,
    host: HTMLDivElement,
    clientX: number,
    clientY: number,
    mode: 'amount' | 'center',
    start: {
      startClientX: number
      startClientY: number
      startAmount: number
      startCenter: number
    },
    precision: 'fine' | 'coarse'
  ) => void
  scheduleLiveEmit: (commands: string[]) => void
  buildCommandForTarget: (
    target: ModTarget,
    control: TargetControl,
    baseMorphModulator: Modulator
  ) => string
  baseMorphModulator: Modulator
  tuningLength: number
}

export function ModulatorsPanel({
  activeModulatorTab,
  setOpenWaveMenu,
  setActiveModulatorTab,
  waveMenuRef,
  openWaveMenu,
  waveAType,
  waveBType,
  selectWaveType,
  waveLerp,
  onWaveLerpChange,
  waveAPulseWidth,
  setWaveAPulseWidth,
  waveBPulseWidth,
  setWaveBPulseWidth,
  wavePadDragRef,
  clampNumber,
  waveHandleA,
  waveHandleB,
  lastWaveHandleUsedRef,
  snapWaveToCenterGuides,
  applyWavePadMotion,
  waveAOpacity,
  waveBOpacity,
  waveAPreviewPath,
  waveBPreviewPath,
  morphedWavePreviewPath,
  targetControls,
  updateTargetControl,
  padDragRef,
  applyPadMotion,
  scheduleLiveEmit,
  buildCommandForTarget,
  baseMorphModulator,
  tuningLength,
}: ModulatorsPanelProps) {
  return (
    <article className="bottomModule bottomModule-rowItem bottomModule-modulators">
      <div className="bottomModuleHeader">
        <p className="bottomModuleLabel">Modulators</p>
        <div className="modTabs" role="tablist" aria-label="Modulator instances">
          {Array.from({ length: 4 }, (_, index) => (
            <button
              key={`mod-tab-${index}`}
              type="button"
              className={`modTab${activeModulatorTab === index ? ' modTab-active' : ''}`}
              onClick={() => {
                setOpenWaveMenu(null)
                setActiveModulatorTab(index)
              }}
              role="tab"
              aria-selected={activeModulatorTab === index}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="modulatorPanel">
        <div className="modulatorTopRow" ref={waveMenuRef}>
          <div className="waveSelect">
            <button
              type="button"
              className="waveSelectTrigger mono"
              onClick={() => setOpenWaveMenu((previous) => (previous === 'a' ? null : 'a'))}
              aria-haspopup="listbox"
              aria-expanded={openWaveMenu === 'a'}
              aria-label="Wave A type"
            >
              <span>{WAVE_OPTION_LABELS[waveAType]}</span>
              <span className="waveSelectChevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {openWaveMenu === 'a' ? (
              <div className="waveSelectMenu" role="listbox" aria-label="Wave A options">
                {WAVE_OPTIONS.map((waveType) => (
                  <button
                    key={`wave-a-option-${waveType}`}
                    type="button"
                    className={`waveSelectOption mono${waveType === waveAType ? ' waveSelectOption-active' : ''}`}
                    onClick={() => selectWaveType('a', waveType)}
                    role="option"
                    aria-selected={waveType === waveAType}
                  >
                    {WAVE_OPTION_LABELS[waveType]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <input
            className="modulatorSlider modulatorTopLerp"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={waveLerp}
            onChange={(event) => onWaveLerpChange(Number(event.target.value))}
            aria-label="Wave lerp"
          />
          <div className="waveSelect">
            <button
              type="button"
              className="waveSelectTrigger mono"
              onClick={() => setOpenWaveMenu((previous) => (previous === 'b' ? null : 'b'))}
              aria-haspopup="listbox"
              aria-expanded={openWaveMenu === 'b'}
              aria-label="Wave B type"
            >
              <span>{WAVE_OPTION_LABELS[waveBType]}</span>
              <span className="waveSelectChevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {openWaveMenu === 'b' ? (
              <div className="waveSelectMenu" role="listbox" aria-label="Wave B options">
                {WAVE_OPTIONS.map((waveType) => (
                  <button
                    key={`wave-b-option-${waveType}`}
                    type="button"
                    className={`waveSelectOption mono${waveType === waveBType ? ' waveSelectOption-active' : ''}`}
                    onClick={() => selectWaveType('b', waveType)}
                    role="option"
                    aria-selected={waveType === waveBType}
                  >
                    {WAVE_OPTION_LABELS[waveType]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {(waveAType === 'square' || waveBType === 'square') && (
          <div className="modulatorRow">
            {waveAType === 'square' ? (
              <label className="modulatorField">
                <span className="modulatorFieldLabel">Wave A Pulse Width</span>
                <input
                  className="modulatorSlider"
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.01}
                  value={waveAPulseWidth}
                  onChange={(event) => setWaveAPulseWidth(Number(event.target.value))}
                />
              </label>
            ) : (
              <div className="modulatorField modulatorField-empty" />
            )}
            {waveBType === 'square' ? (
              <label className="modulatorField">
                <span className="modulatorFieldLabel">Wave B Pulse Width</span>
                <input
                  className="modulatorSlider"
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.01}
                  value={waveBPulseWidth}
                  onChange={(event) => setWaveBPulseWidth(Number(event.target.value))}
                />
              </label>
            ) : (
              <div className="modulatorField modulatorField-empty" />
            )}
          </div>
        )}

        <div
          className="modWavePreview"
          aria-label="Morphed wave preview"
          onPointerDown={(event) => {
            if (!(event.currentTarget instanceof HTMLDivElement)) {
              return
            }
            const bounds = event.currentTarget.getBoundingClientRect()
            const xRatio = clampNumber((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
            const yRatio = clampNumber((event.clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1)
            const distanceA = Math.hypot(xRatio - waveHandleA.x / 100, yRatio - waveHandleA.y / 100)
            const distanceB = Math.hypot(xRatio - waveHandleB.x / 100, yRatio - waveHandleB.y / 100)
            const selectedWave: 'a' | 'b' = distanceA <= distanceB ? 'a' : 'b'
            wavePadDragRef.current = {
              pointerId: event.pointerId,
              wave: selectedWave,
              host: event.currentTarget,
              startClientX: event.clientX,
              startClientY: event.clientY,
              moved: false,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const drag = wavePadDragRef.current
            if (!drag || drag.pointerId !== event.pointerId) {
              return
            }
            const movedDistance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY)
            if (!drag.moved && movedDistance >= 3) {
              drag.moved = true
            }
            if (!drag.moved) {
              return
            }
            const lockMode = event.shiftKey ? 'frequency' : event.altKey ? 'offset' : 'none'
            applyWavePadMotion(drag.wave, drag.host, event.clientX, event.clientY, lockMode)
          }}
          onPointerUp={(event) => {
            const drag = wavePadDragRef.current
            if (drag?.pointerId === event.pointerId) {
              if (!drag.moved) {
                const clickWave = lastWaveHandleUsedRef.current
                const bounds = drag.host.getBoundingClientRect()
                const xRatio = clampNumber((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
                const yRatio = clampNumber((event.clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1)
                const isNearFreqCenterLine = Math.abs(xRatio - 0.5) <= 0.06
                const isNearCenterLine = Math.abs(yRatio - 0.5) <= 0.06
                if (isNearCenterLine || isNearFreqCenterLine) {
                  snapWaveToCenterGuides(clickWave, {
                    snapFrequency: isNearFreqCenterLine,
                    snapOffset: isNearCenterLine,
                  })
                } else {
                  const lockMode = event.shiftKey ? 'frequency' : event.altKey ? 'offset' : 'none'
                  applyWavePadMotion(clickWave, drag.host, event.clientX, event.clientY, lockMode)
                }
              }
              wavePadDragRef.current = null
            }
          }}
          onPointerCancel={(event) => {
            if (wavePadDragRef.current?.pointerId === event.pointerId) {
              wavePadDragRef.current = null
            }
          }}
          title="Drag handle: horizontal = frequency, vertical = phase offset. Shift=frequency only. Option/Alt=offset only."
        >
          <svg viewBox="-2 -2 424 144" preserveAspectRatio="none">
            <line x1="0" y1="70" x2="420" y2="70" className="modWaveAxis" />
            <line x1="210" y1="0" x2="210" y2="140" className="modWaveAxis" />
            <line
              x1={`${waveHandleA.x * 4.2}`}
              y1="0"
              x2={`${waveHandleA.x * 4.2}`}
              y2="140"
              className="modWaveGuide modWaveGuide-a"
              style={{ opacity: waveAOpacity }}
            />
            <line
              x1="0"
              y1={`${waveHandleA.y * 1.4}`}
              x2="420"
              y2={`${waveHandleA.y * 1.4}`}
              className="modWaveGuide modWaveGuide-a"
              style={{ opacity: waveAOpacity }}
            />
            <line
              x1={`${waveHandleB.x * 4.2}`}
              y1="0"
              x2={`${waveHandleB.x * 4.2}`}
              y2="140"
              className="modWaveGuide modWaveGuide-b"
              style={{ opacity: waveBOpacity }}
            />
            <line
              x1="0"
              y1={`${waveHandleB.y * 1.4}`}
              x2="420"
              y2={`${waveHandleB.y * 1.4}`}
              className="modWaveGuide modWaveGuide-b"
              style={{ opacity: waveBOpacity }}
            />
            <polyline
              points={waveAPreviewPath}
              className="modWaveLine modWaveLine-a"
              style={{ opacity: waveAOpacity }}
            />
            <polyline
              points={waveBPreviewPath}
              className="modWaveLine modWaveLine-b"
              style={{ opacity: waveBOpacity }}
            />
            <polyline points={morphedWavePreviewPath} className="modWaveLine modWaveLine-mix" />
            <circle
              cx={`${waveHandleA.x * 4.2}`}
              cy={`${waveHandleA.y * 1.4}`}
              r="5"
              className="modWaveHandle modWaveHandle-a"
              style={{ opacity: waveAOpacity }}
            />
            <circle
              cx={`${waveHandleB.x * 4.2}`}
              cy={`${waveHandleB.y * 1.4}`}
              r="5"
              className="modWaveHandle modWaveHandle-b"
              style={{ opacity: waveBOpacity }}
            />
          </svg>
        </div>
        <div className="modTargetList">
          {MOD_TARGET_ORDER.map((target) => {
            const spec = getModTargetSpecForTuning(target, tuningLength)
            const control = targetControls[target]
            const clampedCenter = clampNumber(control.center, spec.min, spec.max)
            const maxPositiveSpan = spec.max - clampedCenter
            const maxNegativeSpan = clampedCenter - spec.min
            const spanMagnitude = clampNumber(Math.abs(control.amount), 0, Math.max(maxPositiveSpan, maxNegativeSpan))
            const isInverted = control.amount < 0
            const spanMin = clampNumber(clampedCenter - spanMagnitude, spec.min, spec.max)
            const spanMax = clampNumber(clampedCenter + spanMagnitude, spec.min, spec.max)
            const left = ((spanMin - spec.min) / (spec.max - spec.min)) * 100
            const right = ((spanMax - spec.min) / (spec.max - spec.min)) * 100
            const center = ((clampedCenter - spec.min) / (spec.max - spec.min)) * 100

            return (
              <div key={`mod-target-${target}`} className="modTargetRow">
                <label className="modTargetHeader">
                  <input
                    className="modTargetLed"
                    type="checkbox"
                    checked={control.enabled}
                    onChange={(event) => updateTargetControl(target, { enabled: event.target.checked })}
                  />
                  <span className="mono">{spec.label}</span>
                </label>
                <div
                  className={`modRangePad${control.enabled ? '' : ' modRangePad-disabled'}`}
                  onPointerDown={(event) => {
                    if (!(event.currentTarget instanceof HTMLDivElement)) {
                      return
                    }
                    if (!control.enabled) {
                      updateTargetControl(target, { enabled: true })
                    }
                    const mode = event.metaKey || event.ctrlKey ? 'center' : 'amount'
                    padDragRef.current = {
                      pointerId: event.pointerId,
                      target,
                      mode,
                      host: event.currentTarget,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      startAmount: control.amount,
                      startCenter: control.center,
                    }
                    event.currentTarget.setPointerCapture(event.pointerId)
                    applyPadMotion(
                      target,
                      event.currentTarget,
                      event.clientX,
                      event.clientY,
                      mode,
                      {
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        startAmount: control.amount,
                        startCenter: control.center,
                      },
                      event.shiftKey ? 'fine' : 'coarse'
                    )
                  }}
                  onPointerMove={(event) => {
                    const drag = padDragRef.current
                    if (!drag || drag.pointerId !== event.pointerId || drag.target !== target) {
                      return
                    }
                    applyPadMotion(
                      target,
                      drag.host,
                      event.clientX,
                      event.clientY,
                      drag.mode,
                      {
                        startClientX: drag.startClientX,
                        startClientY: drag.startClientY,
                        startAmount: drag.startAmount,
                        startCenter: drag.startCenter,
                      },
                      event.shiftKey ? 'fine' : 'coarse'
                    )
                  }}
                  onPointerUp={(event) => {
                    if (padDragRef.current?.pointerId === event.pointerId) {
                      padDragRef.current = null
                    }
                  }}
                  onPointerCancel={(event) => {
                    if (padDragRef.current?.pointerId === event.pointerId) {
                      padDragRef.current = null
                    }
                  }}
                  onDoubleClick={() => {
                    const resetCenter = spec.defaultCenter
                    const resetAmount = 0
                    updateTargetControl(target, {
                      center: resetCenter,
                      amount: resetAmount,
                    })
                    if (control.enabled) {
                      scheduleLiveEmit([
                        buildCommandForTarget(
                          target,
                          {
                            ...control,
                            center: resetCenter,
                            amount: resetAmount,
                          },
                          baseMorphModulator
                        ),
                      ])
                    }
                  }}
                  title="Drag up/down to set depth and inversion. Shift=finer. Cmd/Ctrl+drag moves center."
                >
                  <div className="modRangeTrack" />
                  <div
                    className={`modRangeBand${isInverted ? ' modRangeBand-inverted' : ''}`}
                    style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                  />
                  <div className="modRangeCenter" style={{ left: `${center}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}
